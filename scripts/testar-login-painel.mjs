#!/usr/bin/env node
/**
 * Pai Presente — fumaca do login do painel
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 *
 * Depois do deploy, tenta entrar no painel com cada e-mail de
 * PANEL_ADMIN_EMAIL e a senha de PANEL_ADMIN_PASSWORD, lidos das variaveis da
 * api no Railway. Imprime so o status e o codigo de erro: nunca a senha.
 */

const ENDPOINT = 'https://backboard.railway.com/graphql/v2';
const PANEL_URL = process.env.PANEL_URL ?? 'https://painel.paternar.com.br';
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

function unquote(value) {
  const trimmed = String(value ?? '').trim();
  return /^(["']).*\1$/.test(trimmed) && trimmed.length >= 2 ? trimmed.slice(1, -1).trim() : trimmed;
}

async function main() {
  const { projectToken: ids } = await gql(`query { projectToken { projectId environmentId } }`);
  const { project } = await gql(
    `query ($id: String!) { project(id: $id) { services { edges { node { id name } } } } }`,
    { id: ids.projectId },
  );
  const api = project.services.edges.map((e) => e.node).find((s) => s.name === 'api');
  const { variables } = await gql(
    `query ($p: String!, $e: String!, $s: String!) { variables(projectId: $p, environmentId: $e, serviceId: $s) }`,
    { p: ids.projectId, e: ids.environmentId, s: api.id },
  );
  const rawPassword = variables.PANEL_ADMIN_PASSWORD ?? '';
  const password = unquote(rawPassword);
  const emails = unquote(variables.PANEL_ADMIN_EMAIL).split(',').map(unquote).filter(Boolean);
  console.log(`senha: ${password.length} caracteres (bruta ${rawPassword.length}, aspas=${rawPassword !== password})`);
  console.log(`PANEL_ADMIN_RESET=${JSON.stringify(variables.PANEL_ADMIN_RESET ?? null)}`);

  for (const email of emails) {
    const res = await fetch(`${PANEL_URL}/v1/panel/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: PANEL_URL },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    const outcome = res.ok ? 'ENTROU' : `falhou ${body?.error?.code ?? body?.code ?? ''}`;
    console.log(`login ${email}: HTTP ${res.status} ${outcome}`);
    if (!res.ok) console.log(`::warning::login do painel falhou para ${email} (HTTP ${res.status})`);
  }
}

main().catch((err) => console.log(`::warning::nao consegui testar o login: ${err.message}`));
