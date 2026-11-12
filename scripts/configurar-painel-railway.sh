#!/usr/bin/env bash
# Grava no servico `api` do Railway as tres variaveis do painel da equipe:
#
#   PANEL_JWT_SECRET      gerado aqui (openssl, 48 bytes), ninguem digita nem ve
#   PANEL_ADMIN_EMAIL     o e-mail do primeiro admin (argumento --email)
#   PANEL_ADMIN_PASSWORD  digitada sem eco, ou gerada e salva num arquivo 600
#
# Nenhum valor secreto passa por argumento de linha de comando nem aparece no
# terminal (security.md §4): tudo vai para `railway variable set --stdin`.
#
# O admin e' criado no primeiro boot da API que tiver as tres variaveis. Depois
# disso, trocar PANEL_ADMIN_PASSWORD aqui NAO troca a senha de quem ja existe.
#
# Uso:
#   scripts/configurar-painel-railway.sh --email voce@exemplo.com
#   scripts/configurar-painel-railway.sh --email voce@exemplo.com --gerar-senha
#   scripts/configurar-painel-railway.sh --email ... --forcar   # regrava o segredo
#
# Requer o Railway CLI logado e ligado ao projeto (`railway login`, `railway link`).
set -euo pipefail

SERVICE="api"
EMAIL=""
GENERATE_PASSWORD=0
FORCE=0
PASSWORD_FILE="${HOME}/.entrelacos-painel-senha"
MIN_PASSWORD=12

while [ $# -gt 0 ]; do
  case "$1" in
    --email) EMAIL="$2"; shift 2 ;;
    --service) SERVICE="$2"; shift 2 ;;
    --gerar-senha) GENERATE_PASSWORD=1; shift ;;
    --arquivo-senha) PASSWORD_FILE="$2"; shift 2 ;;
    --forcar) FORCE=1; shift ;;
    -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
    *) echo "argumento desconhecido: $1" >&2; exit 2 ;;
  esac
done

command -v railway >/dev/null || { echo "instale o Railway CLI: https://docs.railway.com/guides/cli" >&2; exit 1; }
command -v openssl >/dev/null || { echo "precisa do openssl" >&2; exit 1; }
railway whoami >/dev/null 2>&1 || { echo "rode 'railway login' antes" >&2; exit 1; }
[[ "$EMAIL" == *@*.* ]] || { echo "informe --email com um e-mail valido" >&2; exit 2; }

# So os NOMES saem do Railway: a tabela de `railway variables` imprime valores (S-008).
existing="$(railway variables --service "$SERVICE" --json | grep -o '"PANEL_JWT_SECRET"' || true)"
if [ -n "$existing" ] && [ "$FORCE" -ne 1 ]; then
  echo "PANEL_JWT_SECRET ja existe em '$SERVICE'. Use --forcar para regravar (desloga a equipe)." >&2
  exit 1
fi

if [ "$GENERATE_PASSWORD" -eq 1 ]; then
  PASSWORD="$(openssl rand -base64 18 | tr -d '\n')"
  ( umask 077; printf '%s\n' "$PASSWORD" > "$PASSWORD_FILE" )
  echo "-> senha gerada e salva em $PASSWORD_FILE (so voce le). Apague depois do primeiro acesso."
else
  printf 'Senha do primeiro admin (minimo %d caracteres): ' "$MIN_PASSWORD" >&2
  IFS= read -rs PASSWORD; echo >&2
  printf 'Repita a senha: ' >&2
  IFS= read -rs CONFIRM; echo >&2
  [ "$PASSWORD" = "$CONFIRM" ] || { echo "as senhas nao conferem" >&2; exit 1; }
  unset CONFIRM
fi
[ "${#PASSWORD}" -ge "$MIN_PASSWORD" ] || { echo "senha curta: minimo $MIN_PASSWORD caracteres" >&2; exit 1; }

echo "-> PANEL_JWT_SECRET (gerado)"
openssl rand -base64 48 | tr -d '\n' | railway variable set PANEL_JWT_SECRET --stdin --service "$SERVICE"

echo "-> PANEL_ADMIN_EMAIL = $EMAIL"
printf '%s' "$EMAIL" | railway variable set PANEL_ADMIN_EMAIL --stdin --service "$SERVICE"

echo "-> PANEL_ADMIN_PASSWORD"
printf '%s' "$PASSWORD" | railway variable set PANEL_ADMIN_PASSWORD --stdin --service "$SERVICE"
unset PASSWORD

echo "pronto. O Railway faz o redeploy da '$SERVICE'; depois entre em https://painel.paternar.com.br com $EMAIL."
