#!/usr/bin/env node
// Prepara o projeto do Railway antes do deploy, pela API publica (GraphQL), com
// o mesmo token de PROJETO que o `railway up` do CI usa (RAILWAY_TOKEN).
//
// O que faz, sem nunca apagar nada e sem repetir o que ja esta feito:
//   1. cria o servico `painel` se ele ainda nao existir;
//   2. grava no `painel` as variaveis de build e de rede (Dockerfile, porta,
//      repasse de /v1 pela rede privada) e o healthcheck em /health;
//   3. garante um dominio do Railway para o painel e tenta o painel.paternar.com.br
//      (o plano pode recusar um segundo dominio proprio: isso vira aviso, nao erro);
//   4. cria no Cloudflare os registros DNS que o Railway pede para esse dominio,
//      se houver CLOUDFLARE_API_TOKEN (permissao Zone > DNS > Edit na zona);
//      sem o token, so imprime o que falta;
//   5. acrescenta em WEB_ORIGINS da `api` as origens que faltam, sem tirar nenhuma;
//   6. grava na `web` o ADSENSE_CLIENT_ID da conta (publico: sai no HTML de todo
//      site com anuncio). Ele so publica a metatag e o /ads.txt; quem liga os
//      anuncios e' ADS_ENABLED, que este script nao toca.
//
// As variaveis sao gravadas com `skipDeploys`: quem publica e' o `railway up`
// dos passos seguintes, que ja leva o valor novo.
//
// Sai com erro so quando algo essencial falha (token, API fora). Se o painel nao
// puder ser preparado, a api e a web seguem, e o passo do painel e' pulado: o
// resultado vai em GITHUB_OUTPUT como `painel=1` ou `painel=0`.
//
// Nenhum valor secreto e' impresso: das variaveis da api so WEB_ORIGINS e' lida.

import { appendFileSync } from 'node:fs';

const ENDPOINT = 'https://backboard.railway.com/graphql/v2';
const PANEL = 'painel';
const API = 'api';
const PORT = 8080;
const API_PORT = Number(process.env.API_PORT || 3000);
const PUBLIC_DOMAIN = 'paternar.com.br';
const PANEL_DOMAIN = `painel.${PUBLIC_DOMAIN}`;
const WEB = 'web';
/** ID de editor da conta AdSense (08/11/2026) — o mesmo de `.railway/railway.ts`. */
const ADSENSE_CLIENT_ID = 'ca-pub-3420826522507538';
const FIXED_ORIGINS = [
  `https://${PUBLIC_DOMAIN}`,
  `https://${PANEL_DOMAIN}`,
  'https://entrelacos.up.railway.app',
];

const token = process.env.RAILWAY_TOKEN;

async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors) {
    const msg = body.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body.data;
}

function output(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

export function mergeOrigins(current, wanted) {
  const list = (current || '').split(',').map((s) => s.trim()).filter(Boolean);
  const missing = wanted.filter((o) => !list.includes(o));
  return { value: [...list, ...missing].join(','), missing };
}

async function listServices(projectId) {
  const data = await gql(
    `query ($id: String!) { project(id: $id) { services { edges { node { id name } } } } }`,
    { id: projectId },
  );
  return data.project.services.edges.map((e) => e.node);
}

async function upsert(ids, serviceId, name, value) {
  await gql(
    `mutation ($input: VariableUpsertInput!) { variableUpsert(input: $input) }`,
    { input: { ...ids, serviceId, name, value, skipDeploys: true } },
  );
}

async function preparePanel(ids, services) {
  let panel = services.find((s) => s.name === PANEL);
  if (!panel) {
    console.log(`-> criando o servico '${PANEL}'`);
    const data = await gql(
      `mutation ($input: ServiceCreateInput!) { serviceCreate(input: $input) { id name } }`,
      { input: { projectId: ids.projectId, name: PANEL } },
    );
    panel = data.serviceCreate;
  } else {
    console.log(`-> servico '${PANEL}' ja existe`);
  }

  const vars = {
    RAILWAY_DOCKERFILE_PATH: 'apps/painel-paternar/Dockerfile',
    API_ORIGIN: `http://\${{${API}.RAILWAY_PRIVATE_DOMAIN}}:${API_PORT}`,
    WEB_PORT: String(PORT),
    PORT: String(PORT),
  };
  for (const [name, value] of Object.entries(vars)) await upsert(ids, panel.id, name, value);
  console.log(`-> variaveis do painel: ${Object.keys(vars).join(', ')}`);

  try {
    await gql(
      `mutation ($sid: String!, $eid: String, $input: ServiceInstanceUpdateInput!) {
         serviceInstanceUpdate(serviceId: $sid, environmentId: $eid, input: $input) }`,
      { sid: panel.id, eid: ids.environmentId, input: { healthcheckPath: '/health', restartPolicyType: 'ON_FAILURE' } },
    );
  } catch (err) {
    console.log(`::warning::healthcheck do painel nao gravado: ${err.message}`);
  }

  const domains = await gql(
    `query ($p: String!, $e: String!, $s: String!) {
       domains(projectId: $p, environmentId: $e, serviceId: $s) {
         serviceDomains { domain } customDomains { domain } } }`,
    { p: ids.projectId, e: ids.environmentId, s: panel.id },
  );
  let railwayDomain = domains.domains.serviceDomains[0]?.domain;
  if (!railwayDomain) {
    const data = await gql(
      `mutation ($input: ServiceDomainCreateInput!) { serviceDomainCreate(input: $input) { domain } }`,
      { input: { environmentId: ids.environmentId, serviceId: panel.id, targetPort: PORT } },
    );
    railwayDomain = data.serviceDomainCreate.domain;
  }
  console.log(`-> painel no Railway: https://${railwayDomain}`);

  if (!domains.domains.customDomains.some((d) => d.domain === PANEL_DOMAIN)) {
    try {
      await gql(
        `mutation ($input: CustomDomainCreateInput!) { customDomainCreate(input: $input) { id } }`,
        { input: { projectId: ids.projectId, environmentId: ids.environmentId, serviceId: panel.id, domain: PANEL_DOMAIN, targetPort: PORT } },
      );
      console.log(`-> dominio ${PANEL_DOMAIN} criado no Railway`);
    } catch (err) {
      console.log(`::warning::${PANEL_DOMAIN} nao foi criado (${err.message}). O painel segue em https://${railwayDomain}`);
    }
  }

  try {
    await syncPanelDns(ids, panel.id);
  } catch (err) {
    console.log(`::warning::DNS do ${PANEL_DOMAIN} nao conferido: ${err.message}`);
  }
  return railwayDomain;
}

// Registros que o Railway pede para o dominio proprio do painel. Sao publicos
// (qualquer um ve o CNAME de um dominio), entao vao para o log.
async function panelDnsRecords(ids, serviceId) {
  const data = await gql(
    `query ($p: String!, $e: String!, $s: String!) {
       domains(projectId: $p, environmentId: $e, serviceId: $s) {
         customDomains { domain status { dnsRecords { fqdn recordType requiredValue } } } } }`,
    { p: ids.projectId, e: ids.environmentId, s: serviceId },
  );
  const domain = data.domains.customDomains.find((d) => d.domain === PANEL_DOMAIN);
  const records = (domain?.status?.dnsRecords || [])
    .map((r) => ({ name: r.fqdn, type: String(r.recordType).replace(/^DNS_RECORD_TYPE_/, ''), content: r.requiredValue }))
    .filter((r) => r.name && r.content && ['CNAME', 'TXT', 'A', 'AAAA'].includes(r.type));

  // O TXT `_railway-verify` nao vem em dnsRecords: sem ele o Railway nao
  // verifica o dominio, nao emite o certificado e o navegador recebe o do
  // *.up.railway.app (ERR_CERT_COMMON_NAME_INVALID).
  try {
    const v = await gql(
      `query ($p: String!, $e: String!, $s: String!) {
         domains(projectId: $p, environmentId: $e, serviceId: $s) {
           customDomains { domain status { verified verificationDnsHost verificationToken certificateStatus } } } }`,
      { p: ids.projectId, e: ids.environmentId, s: serviceId },
    );
    const st = v.domains.customDomains.find((d) => d.domain === PANEL_DOMAIN)?.status || {};
    console.log(`-> ${PANEL_DOMAIN}: verificado=${st.verified} certificado=${st.certificateStatus}`);
    const txt = verificationRecord(st.verificationDnsHost, st.verificationToken);
    if (txt && !records.some((r) => r.type === 'TXT' && r.name === txt.name)) records.push(txt);
  } catch (err) {
    console.log(`::warning::status de verificacao do ${PANEL_DOMAIN} indisponivel: ${err.message}`);
  }
  return records;
}

export function verificationRecord(host, token) {
  if (!host || !token) return null;
  const name = host.endsWith(PUBLIC_DOMAIN) ? host : `${host}.${PUBLIC_DOMAIN}`;
  const content = token.startsWith('railway-verify=') ? token : `railway-verify=${token}`;
  return { name, type: 'TXT', content };
}

async function cloudflare(path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(body.errors?.map((e) => e.message).join('; ') || `Cloudflare HTTP ${res.status}`);
  }
  return body.result;
}

// Sem CLOUDFLARE_API_TOKEN so mostra o que falta; com ele, cria ou corrige os
// registros na zona (CNAME em "DNS only": o certificado e' do Railway).
async function syncPanelDns(ids, serviceId) {
  const records = await panelDnsRecords(ids, serviceId);
  if (!records.length) {
    console.log(`-> o Railway ainda nao listou registros DNS para ${PANEL_DOMAIN}`);
    return;
  }
  if (!process.env.CLOUDFLARE_API_TOKEN) {
    for (const r of records) console.log(`-> falta no Cloudflare: ${r.type} ${r.name} -> ${r.content}`);
    console.log('::warning::sem CLOUDFLARE_API_TOKEN: crie os registros acima no Cloudflare (DNS only)');
    return;
  }
  const [zone] = await cloudflare(`/zones?name=${PUBLIC_DOMAIN}`);
  if (!zone) throw new Error(`zona ${PUBLIC_DOMAIN} nao encontrada no Cloudflare`);
  for (const r of records) {
    const found = await cloudflare(`/zones/${zone.id}/dns_records?type=${r.type}&name=${encodeURIComponent(r.name)}`);
    const record = { type: r.type, name: r.name, content: r.content, ttl: 1, ...(r.type === 'TXT' ? {} : { proxied: false }) };
    if (found.some((f) => f.content.replace(/^"|"$/g, '') === r.content)) {
      console.log(`-> Cloudflare ja tem ${r.type} ${r.name}`);
    } else if (found.length) {
      await cloudflare(`/zones/${zone.id}/dns_records/${found[0].id}`, { method: 'PUT', body: JSON.stringify(record) });
      console.log(`-> Cloudflare: ${r.type} ${r.name} corrigido`);
    } else {
      await cloudflare(`/zones/${zone.id}/dns_records`, { method: 'POST', body: JSON.stringify(record) });
      console.log(`-> Cloudflare: ${r.type} ${r.name} criado`);
    }
  }
}

async function main() {
  if (!token) throw new Error('RAILWAY_TOKEN ausente');
  const { projectToken: ids } = await gql(`query { projectToken { projectId environmentId } }`);
  const services = await listServices(ids.projectId);
  const api = services.find((s) => s.name === API);
  if (!api) throw new Error(`servico '${API}' nao encontrado`);

  let panelDomain = null;
  try {
    panelDomain = await preparePanel(ids, services);
    output('painel', '1');
  } catch (err) {
    console.log(`::error::painel nao preparado: ${err.message}`);
    output('painel', '0');
  }

  const vars = await gql(
    `query ($p: String!, $e: String!, $s: String!) { variables(projectId: $p, environmentId: $e, serviceId: $s) }`,
    { p: ids.projectId, e: ids.environmentId, s: api.id },
  );
  const wanted = panelDomain ? [...FIXED_ORIGINS, `https://${panelDomain}`] : FIXED_ORIGINS;
  const { value, missing } = mergeOrigins(vars.variables.WEB_ORIGINS, wanted);
  if (missing.length) {
    await upsert(ids, api.id, 'WEB_ORIGINS', value);
    console.log(`-> WEB_ORIGINS da api ganhou: ${missing.join(', ')}`);
  } else {
    console.log('-> WEB_ORIGINS da api ja tem todas as origens');
  }

  await ensureAdsenseAccount(ids, services);
}

/** Falhar aqui nao derruba o deploy: sem o id, so a verificacao do AdSense espera. */
async function ensureAdsenseAccount(ids, services) {
  const web = services.find((s) => s.name === WEB);
  if (!web) {
    console.log(`::warning::servico '${WEB}' nao encontrado; ADSENSE_CLIENT_ID nao gravado`);
    return;
  }
  try {
    const vars = await gql(
      `query ($p: String!, $e: String!, $s: String!) { variables(projectId: $p, environmentId: $e, serviceId: $s) }`,
      { p: ids.projectId, e: ids.environmentId, s: web.id },
    );
    const current = (vars.variables.ADSENSE_CLIENT_ID ?? '').trim();
    if (current === ADSENSE_CLIENT_ID) {
      console.log('-> ADSENSE_CLIENT_ID da web ja esta certo');
    } else {
      await upsert(ids, web.id, 'ADSENSE_CLIENT_ID', ADSENSE_CLIENT_ID);
      console.log(`-> ADSENSE_CLIENT_ID da web gravado (antes: ${current ? 'outro valor' : 'ausente'})`);
    }
    console.log(`-> ADS_ENABLED da web: ${JSON.stringify(vars.variables.ADS_ENABLED ?? '(ausente)')}`);
  } catch (err) {
    console.log(`::warning::ADSENSE_CLIENT_ID nao gravado na web: ${err.message}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`::error::${err.message}`);
    process.exit(1);
  });
}
