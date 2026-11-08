#!/usr/bin/env node
/**
 * Pai Presente — diagnostico de deploy
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Quando o healthcheck da api reprova, o Railway so diz "Healthcheck failure".
 * Este script imprime o log de EXECUCAO do deploy mais recente da api (o que
 * reprovou, e nao o que ainda esta no ar) e os NOMES das variaveis do servico,
 * nunca os valores. Roda so no passo de falha do deploy.yml.
 */

const ENDPOINT = 'https://backboard.railway.com/graphql/v2';
const SERVICE = process.argv[2] ?? 'api';
/** Opcional: so as linhas que contem este texto (ex.: 'painel'). */
const FILTER = process.argv[3] ?? '';
const token = process.env.RAILWAY_TOKEN;

async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors) throw new Error(body.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`);
  return body.data;
}

async function main() {
  if (!token) throw new Error('RAILWAY_TOKEN ausente');
  const { projectToken: ids } = await gql(`query { projectToken { projectId environmentId } }`);
  const { project } = await gql(
    `query ($id: String!) { project(id: $id) { services { edges { node { id name } } } } }`,
    { id: ids.projectId },
  );
  const service = project.services.edges.map((e) => e.node).find((s) => s.name === SERVICE);
  if (!service) throw new Error(`servico '${SERVICE}' nao encontrado`);

  const vars = await gql(
    `query ($p: String!, $e: String!, $s: String!) { variables(projectId: $p, environmentId: $e, serviceId: $s) }`,
    { p: ids.projectId, e: ids.environmentId, s: service.id },
  );
  console.log(`variaveis de ${SERVICE} (so nomes): ${Object.keys(vars.variables).sort().join(', ')}`);

  const { deployments } = await gql(
    `query ($input: DeploymentListInput!) { deployments(first: 3, input: $input) { edges { node { id status createdAt } } } }`,
    { input: { projectId: ids.projectId, environmentId: ids.environmentId, serviceId: service.id } },
  );
  const list = deployments.edges.map((e) => e.node);
  for (const d of list) console.log(`deploy ${d.id} ${d.status} ${d.createdAt}`);
  const latest = list[0];
  if (!latest) return;

  const { deploymentLogs } = await gql(
    `query ($id: String!) { deploymentLogs(deploymentId: $id, limit: 150) { timestamp message severity } }`,
    { id: latest.id },
  );
  console.log(`--- log de execucao do deploy ${latest.id} ---`);
  for (const line of deploymentLogs.filter((l) => !FILTER || l.message.includes(FILTER))) console.log(`${line.timestamp} [${line.severity ?? ''}] ${line.message}`);
}

main().catch((err) => {
  console.log(`::warning::nao consegui ler o log do Railway: ${err.message}`);
});
