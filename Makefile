# Abstrai os comandos do projeto (code-standart.md §4).
# ENV escolhe o arquivo de envs/; PROJECT_NAME sai de lá e prefixa todo recurso.

ENV ?= dev
ENV_FILE := envs/env.$(ENV)
ENV_LOCAL := envs/env.$(ENV).local

ifeq (,$(wildcard $(ENV_FILE)))
$(error $(ENV_FILE) nao existe — ENV=$(ENV) invalido)
endif

include $(ENV_FILE)
export
-include $(ENV_LOCAL)
export

# O docker RECUSA ponto no nome do projeto, e o ENV vem do nome do arquivo
# (`env.test.e2e`). Traduzir aqui e o que deixa `make up ENV=test.e2e` existir
# sem renomear o arquivo de ambiente que a spec nomeia.
COMPOSE_PROJECT := $(PROJECT_NAME)-$(subst .,-,$(ENV))
COMPOSE := docker compose --project-name $(COMPOSE_PROJECT)

IMAGE_TAG ?= local
API_IMAGE := $(PROJECT_NAME)-api:$(IMAGE_TAG)
WEB_IMAGE := $(PROJECT_NAME)-web:$(IMAGE_TAG)
PAINEL_IMAGE := $(PROJECT_NAME)-painel:$(IMAGE_TAG)

# Medido: o compose publica o banco em `127.0.0.1:$(POSTGRES_PORT)`, so no
# loopback (security.md §5). Contêiner que chega pelo `host-gateway` NAO vem do
# loopback, entao ele nunca conecta — e como `/health` nao toca no banco, a
# imagem responde saudavel mentindo. A ligacao certa e' entrar na rede do
# compose e chamar o servico pelo nome, na porta de dentro.
IMAGE_NETWORK := $(COMPOSE_PROJECT)_default
IMAGE_DATABASE_URL := postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@postgres:5432/$(POSTGRES_DB)
IMAGE_API_PORT ?= 3410
IMAGE_WEB_PORT ?= 5410
IMAGE_SICK_PORT ?= 3411

# Medido: a imagem de producao RECUSA subir sem provedor de login — `AUTH_DEV_SIGN_IN`
# nao vale com `NODE_ENV=production`, e o boot morre dizendo o que falta. E' o
# comportamento certo (fail-closed, security.md §2), entao a fumaca entrega o
# identificador que a producao vai entregar. Vazio no `env.dev` porque o D7 ainda
# nao tem credencial real (`F5.1`); identificador de cliente OIDC e' publico, nunca
# segredo.
IMAGE_GOOGLE_CLIENT_ID ?= fumaca.apps.googleusercontent.com

# O banco descartavel da PROVA de restauracao. Ensaiar por cima do banco vivo e'
# o ensaio que ninguem faz — e backup que nunca voltou nao e backup, e esperanca.
BACKUP_SCRATCH_DB := $(POSTGRES_DB)_restore
PG_CONNECT := -h localhost -p $(POSTGRES_PORT) -U $(POSTGRES_USER)
PG_DUMP_FLAGS := --format=plain --no-owner --no-privileges

.PHONY: help compose-project up down logs psql generate migrate seed install dev dev-web dev-painel dev-api build images image-api image-web image-painel image-smoke backup restore backup-proof log-pii-audit test test-e2e typecheck validate github-railway painel-railway clean

help: ## lista os alvos
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$'  Makefile | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

compose-project: ## imprime o nome do projeto docker do ambiente
	@echo $(COMPOSE_PROJECT)

up: ## sobe a infra local
	$(COMPOSE) up -d --wait

down: ## derruba a infra local
	$(COMPOSE) down

logs: ## acompanha os logs da infra
	$(COMPOSE) logs -f

psql: ## abre o psql no banco do ambiente
	$(COMPOSE) exec postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

generate: ## gera a migration SQL a partir do schema
	cd apps/api-pai-presente && bun run db:generate

migrate: ## aplica as migrations no banco do ambiente
	cd apps/api-pai-presente && bun run db:migrate

seed: migrate ## popula o banco do ambiente pelos use cases (idempotente)
	cd apps/api-pai-presente && bun run db:seed

install: ## instala dependencias de todas as apps
	bun install

dev: up migrate ## sobe infra, api e web de uma vez (Ctrl-C derruba os dois)
	@trap 'kill 0' EXIT INT TERM; \
	$(MAKE) dev-api & \
	$(MAKE) dev-web & \
	wait

dev-web: ## sobe o frontend
	cd apps/frontend-pai-presente && bun run dev

dev-painel: ## sobe o painel da equipe (porta PAINEL_PORT, padrao 5174)
	cd apps/painel-paternar && bun run dev

dev-api: ## sobe a api
	cd apps/api-pai-presente && bun run dev

build: ## build de producao
	cd apps/frontend-pai-presente && bun run build
	cd apps/painel-paternar && bun run build

image-api: ## constroi a imagem da API
	docker build -f apps/api-pai-presente/Dockerfile -t $(API_IMAGE) .

image-web: ## constroi a imagem da web (APP_ENV e assado no bundle, web.md §12)
	docker build -f apps/frontend-pai-presente/Dockerfile \
		--build-arg APP_ENV=$(APP_ENV) \
		--build-arg GOOGLE_CLIENT_ID=$(GOOGLE_CLIENT_ID) \
		--build-arg APPLE_CLIENT_ID=$(APPLE_CLIENT_ID) \
		-t $(WEB_IMAGE) .

image-painel: ## constroi a imagem do painel da equipe
	docker build -f apps/painel-paternar/Dockerfile -t $(PAINEL_IMAGE) .

images: image-api image-web image-painel ## constroi as tres imagens

# Imagem que compila nao e imagem que responde: o bundle pode subir e morrer no
# primeiro `import`, e o `dist` pode ir vazio para dentro do contêiner sem que
# nada reclame. Este alvo SOBE as duas e pergunta.
image-smoke: images up ## prova que as duas imagens sobem, migram e respondem
	@set -e; \
	trap 'docker rm -f $(PROJECT_NAME)-smoke-api $(PROJECT_NAME)-smoke-web $(PROJECT_NAME)-smoke-doente >/dev/null 2>&1 || true' EXIT; \
	echo "migrate (de dentro da imagem) -> $$(docker run --rm --network $(IMAGE_NETWORK) \
		-e DATABASE_URL='$(IMAGE_DATABASE_URL)' \
		$(API_IMAGE) bun dist/database/migrate.js >/dev/null 2>&1 && echo ok || echo FALHOU)"; \
	docker run -d --rm --name $(PROJECT_NAME)-smoke-api --network $(IMAGE_NETWORK) \
		-e DATABASE_URL='$(IMAGE_DATABASE_URL)' \
		-e AUTH_JWT_SECRET='$(AUTH_JWT_SECRET)' \
		-e LLM_PROVIDER='$(LLM_PROVIDER)' \
		-e GOOGLE_CLIENT_ID='$(IMAGE_GOOGLE_CLIENT_ID)' \
		-e API_PORT=3000 \
		-p 127.0.0.1:$(IMAGE_API_PORT):3000 $(API_IMAGE) >/dev/null; \
	docker run -d --rm --name $(PROJECT_NAME)-smoke-web --network $(IMAGE_NETWORK) \
		-e API_ORIGIN='http://$(PROJECT_NAME)-smoke-api:3000' \
		-p 127.0.0.1:$(IMAGE_WEB_PORT):8080 $(WEB_IMAGE) >/dev/null; \
	for attempt in 1 2 3 4 5 6 7 8 9 10; do \
		curl -fsS http://127.0.0.1:$(IMAGE_API_PORT)/health >/dev/null 2>&1 && break || sleep 1; \
	done; \
	echo "api  /health         -> $$(curl -fsS http://127.0.0.1:$(IMAGE_API_PORT)/health)"; \
	echo "web  /health         -> $$(curl -fsS http://127.0.0.1:$(IMAGE_WEB_PORT)/health)"; \
	echo "web  /               -> HTTP $$(curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:$(IMAGE_WEB_PORT)/)"; \
	echo "web  /v1/me (repasse)-> HTTP $$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:$(IMAGE_WEB_PORT)/v1/me)"; \
	echo "web  blindagem       -> $$(curl -fsS -o /dev/null -D - http://127.0.0.1:$(IMAGE_WEB_PORT)/ | grep -ciE '^(content-security-policy|strict-transport-security|x-frame-options|x-content-type-options|referrer-policy|permissions-policy):') de 6 cabecalhos"; \
	echo "web  script-src      -> $$(curl -fsS -o /dev/null -D - http://127.0.0.1:$(IMAGE_WEB_PORT)/ | grep -i '^content-security-policy:' | tr ';' '\n' | grep -i 'script-src')"; \
	echo "api  blindagem       -> $$(curl -fsS -o /dev/null -D - http://127.0.0.1:$(IMAGE_API_PORT)/health | grep -ciE '^(content-security-policy|strict-transport-security|x-frame-options|x-content-type-options|referrer-policy|permissions-policy):') de 6 cabecalhos"; \
	docker run -d --rm --name $(PROJECT_NAME)-smoke-doente --network $(IMAGE_NETWORK) \
		-e DATABASE_URL='postgres://ninguem:ninguem@banco-que-nao-existe:5432/nada' \
		-e AUTH_JWT_SECRET='$(AUTH_JWT_SECRET)' \
		-e LLM_PROVIDER='$(LLM_PROVIDER)' \
		-e GOOGLE_CLIENT_ID='$(IMAGE_GOOGLE_CLIENT_ID)' \
		-e API_PORT=3000 \
		-p 127.0.0.1:$(IMAGE_SICK_PORT):3000 $(API_IMAGE) >/dev/null; \
	sleep 3; \
	echo "api  /health SEM banco -> HTTP $$(curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:$(IMAGE_SICK_PORT)/health)"; \
	docker rm -f $(PROJECT_NAME)-smoke-doente >/dev/null

backup: ## dump cifrado no destino do ambiente (security.md §5)
	bun apps/api-pai-presente/src/backup/run-backup.ts

restore: ## restaura o mais recente, ou `make restore OBJECT_KEY=...`
	bun apps/api-pai-presente/src/backup/run-restore.ts $(OBJECT_KEY)

# Backup que nunca voltou nao e backup. Este alvo faz o ciclo INTEIRO — semeia,
# cifra, guarda, restaura num banco descartavel e compara os dois — porque cada
# metade sozinha passa: cifrar sem restaurar guarda lixo indecifravel, e
# restaurar sem comparar aceita um dump truncado como sucesso.
#
# A comparacao NAO e' o sha do dump inteiro. Medido: o mesmo banco, dumpado duas
# vezes seguidas, da dois shas diferentes — o Postgres 17 abre cada dump com um
# `\restrict` de valor sorteado. Quem comparar o arquivo cru monta uma prova que
# reprova sempre, inclusive quando o restore esta perfeito.
# Entao compara-se o que o restore precisa devolver: os DADOS (dump `--data-only`
# sem as linhas de sessao) e a FORMA (colunas e tipos de `information_schema`) —
# a segunda existe porque tabela perdida que estava vazia nao muda a primeira.
backup-proof: up migrate seed ## prova o ciclo: cifra, guarda, restaura e confere
	@set -e; \
	dados() { PGPASSWORD='$(POSTGRES_PASSWORD)' pg_dump $(PG_CONNECT) $(PG_DUMP_FLAGS) --data-only -d "$$1" \
		| grep -vE '^(\\restrict|\\unrestrict|--|SET |$$)' | shasum -a 256 | cut -d' ' -f1; }; \
	forma() { PGPASSWORD='$(POSTGRES_PASSWORD)' psql -q -t -A $(PG_CONNECT) -d "$$1" \
		-c "select table_name||'.'||column_name||':'||data_type from information_schema.columns where table_schema='public' order by 1" \
		| shasum -a 256 | cut -d' ' -f1; }; \
	rm -rf .backups; \
	bun apps/api-pai-presente/src/backup/run-backup.ts >/dev/null; \
	envelope=$$(ls .backups/pai-presente/$(BACKUP_ENVIRONMENT)/*/*.sql.enc | tail -1); \
	echo "envelope            -> $$envelope, $$(wc -c < $$envelope | tr -d ' ') bytes"; \
	echo "nome semeado dentro -> $$(grep -ac -e Alice -e Miguel $$envelope || true) ocorrencia(s)"; \
	test "$$(grep -ac -e Alice -e Miguel $$envelope || true)" = "0" || { echo "TEXTO CLARO no balde"; exit 1; }; \
	$(COMPOSE) exec -T postgres psql -q -U $(POSTGRES_USER) -d postgres -v ON_ERROR_STOP=1 \
		-c 'DROP DATABASE IF EXISTS $(BACKUP_SCRATCH_DB)' \
		-c 'CREATE DATABASE $(BACKUP_SCRATCH_DB)' >/dev/null 2>&1; \
	RESTORE_DATABASE_URL='postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@localhost:$(POSTGRES_PORT)/$(BACKUP_SCRATCH_DB)' \
		bun apps/api-pai-presente/src/backup/run-restore.ts >/dev/null; \
	echo "dados  origem/volta -> $$(dados $(POSTGRES_DB)) / $$(dados $(BACKUP_SCRATCH_DB))"; \
	echo "forma  origem/volta -> $$(forma $(POSTGRES_DB)) / $$(forma $(BACKUP_SCRATCH_DB))"; \
	test "$$(dados $(POSTGRES_DB))" = "$$(dados $(BACKUP_SCRATCH_DB))" || { echo "os DADOS divergiram"; exit 1; }; \
	test "$$(forma $(POSTGRES_DB))" = "$$(forma $(BACKUP_SCRATCH_DB))" || { echo "a FORMA divergiu"; exit 1; }; \
	echo "restore PROVADO     -> o banco descartavel voltou identico ao de origem"

# `security.md` §1 vale ate em `debug`, e aqui quase toda tabela tem nome de
# crianca. A varredura roda contra a SAIDA de uma API viva respondendo pedido
# de verdade, com iscas plantadas — nao contra o codigo: `logger.info('salvo',
# { child })` passa em revisao e so aparece quando executa.
log-pii-audit: up migrate ## varre o log de uma api viva atras de PII
	cd apps/api-pai-presente && bun scripts/audit-log-pii.ts

typecheck: ## checagem de tipos
	cd apps/api-pai-presente && bun run typecheck

test: ## testes
	bun test
	@# `.railway/` comeca com ponto, e `bun test` nao entra em pasta oculta: sem
	@# esta linha o teste da infraestrutura existe e nunca roda.
	bun test ./.railway/railway.test.ts

test-e2e: ## fumaca ponta a ponta na API de verdade, no banco de env.test.e2e
	$(MAKE) up ENV=test.e2e
	$(MAKE) migrate ENV=test.e2e
	PP_E2E=1 bun test apps/api-pai-presente/src/e2e

validate: typecheck test ## portao de qualidade

github-railway: ## cadastra RAILWAY_TOKEN no GitHub (`make github-railway TOKEN_FILE=... URL=...`)
	scripts/configurar-github-railway.sh $(if $(TOKEN_FILE),--token-file $(TOKEN_FILE)) $(if $(URL),--url $(URL))

painel-railway: ## grava as variaveis do painel no Railway (`make painel-railway EMAIL=...`)
	scripts/configurar-painel-railway.sh --email $(EMAIL) $(if $(GERAR),--gerar-senha)

clean: ## remove build e dependencias
	rm -rf apps/*/dist apps/*/node_modules node_modules
