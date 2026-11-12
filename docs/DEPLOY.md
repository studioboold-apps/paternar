# Publicar o Pai Presente

> **06/11/2026 — domínio próprio.** O app atende em `https://paternar.com.br`
> (Registro.br, DNS no Cloudflare: CNAME `@` → alvo do Railway, TXT
> `_railway-verify`, e `www` redirecionado para a raiz por Redirect Rule). O
> plano do Railway aceita um domínio personalizado só. O endereço
> `entrelacos.up.railway.app` continua no ar. Ao trocar o domínio, mude também
> `WEB_ORIGINS` da `api` (senão o login dá 403), as origens do Client ID OAuth no
> Google e `RAILWAY_PUBLIC_URL` no ambiente `production` do GitHub.
>
> **Painel da equipe: app e serviço próprios.** `apps/painel-paternar` sobe no
> serviço `painel` (`apps/painel-paternar/Dockerfile`), em
> `painel.paternar.com.br`. Quem cria e configura é o próprio deploy: o passo
> `servicos e variaveis no Railway` (`scripts/railway-garantir-servicos.mjs`)
> cria o serviço se faltar, grava `RAILWAY_DOCKERFILE_PATH`, `API_ORIGIN`,
> `WEB_PORT`, `PORT` e o healthcheck, gera um domínio `*.up.railway.app` e tenta
> o `painel.paternar.com.br`, e acrescenta as origens que faltam em
> `WEB_ORIGINS` da `api`. Se o plano recusar o segundo domínio próprio, o painel
> segue no domínio do Railway (aviso no log). Com o segredo
> `CLOUDFLARE_API_TOKEN` no ambiente `production` do GitHub (token do Cloudflare
> com Zone → DNS → Edit em paternar.com.br), o mesmo passo cria no Cloudflare o
> CNAME `painel` e o TXT de verificação que o Railway pedir; sem ele, o log
> lista os registros para criar à mão.

> **31/10/2026 — projeto novo.** A produção mudou para o workspace da empresa
> no Railway (projeto `6cb88306…`, ambiente `production`), criada a partir de
> `.railway/railway.ts` com `railway config apply`. Endereço novo:
> `https://entrelacos.up.railway.app` (era `web-production-7c849`, depois `entrelassos`, até a correção do nome). Região `iad` e volume de
> mídia de 500 MB, o teto do plano atual. O deploy agora é pelo GitHub Actions
> (§7). O que segue abaixo descreve o projeto antigo e continua valendo como
> registro do desenho.

Estado em 05/09/2026: **está no ar.** `D6` fechou em **Railway**, e o endereço
público é `https://web-production-1d6f.up.railway.app`. A API não tem endereço
público de propósito (§1), e as migrations entraram pelo pre-deploy (§2).

---

## 1. O desenho, e por que a API não tem URL pública

Três peças: **web** (pública), **API** (privada) e **Postgres** (privado).

```
navegador ──HTTPS──> web (dist + repasse de /v1) ──rede privada──> API ──> Postgres
```

O cookie de sessão sai `SameSite=Lax` e **sem `Domain`** (host-only). Se a tela
morasse num host e a API em outro, o navegador guardaria o cookie no host da API
e não o devolveria em chamada vinda de outro **site** — e em `fly.dev`, que está
na Public Suffix List, `app.fly.dev` e `api.fly.dev` são sites diferentes. O pai
entraria, a tela recarregaria deslogada, e **não apareceria erro nenhum**.

Por isso a imagem da web repassa `/v1` para `API_ORIGIN`, exatamente como o proxy
do Vite faz em desenvolvimento. Consequências que valem dizer em voz alta:

- a API **não precisa** de endereço público — `API_ORIGIN` aponta para a rede
  interna do provedor (`*.railway.internal` ou `*.internal` no Fly);
- não há CORS a configurar: é tudo mesma origem;
- `VITE_API_BASE_URL` fica **vazia** nos dois ambientes.

## 2. Migrations no deploy

O comando é sempre este, e ele roda **de dentro da imagem da API**:

```
bun dist/database/migrate.js
```

O mesmo comando aplica, depois das migrations do app, as dos módulos do SDK
(`user`, `customer` e `recommendation`, cada um no seu schema), que a imagem
leva em `sdk-migrations/`. Rodar de novo não muda nada.

Nunca `drizzle-kit push` (`database.md`): empurrar schema não deixa migration
revisável e não tem volta escrita.

| provedor | onde declarar |
|---|---|
| Fly.io | `[deploy] release_command` no `fly.toml` da API |
| Railway | *pre-deploy command* do serviço da API |

Nos dois casos o passo roda **antes** de a versão nova receber tráfego, e o
deploy para se ele falhar.

Provado localmente (`make image-smoke`): `migrate (de dentro da imagem) -> ok`.

## 3. `/health` responde pelo banco

`GET /health` faz `select 1` e devolve **503** se o banco não responde. Isso
existe porque a saúde fixa mentia: na primeira fumaça o contêiner respondeu
`{"status":"ok"}` com o banco **inalcançável** — e é esse endereço que o
provedor consulta para decidir se promove o deploy.

Configure o health check do provedor em `/health` do serviço da API **e** do
serviço da web.

Medido: `api /health -> {"data":{"status":"ok","database":"ok"}}`, e
`api /health SEM banco -> HTTP 503`.

## 4. Variáveis por serviço

Nenhum valor mora neste arquivo nem no repositório (`security.md` §4).

### API (variáveis de execução)

| nome | obrigatória | observação |
|---|---|---|
| `DATABASE_URL` | sim | endereço privado do Postgres do provedor |
| `AUTH_JWT_SECRET` | sim | mínimo 32 caracteres, rotacionável |
| `LLM_PROVIDER` | sim | sem padrão, de propósito (`D8`) |
| `LLM_API_KEY` | depende de `D8` | sem ela, quatro rotas respondem 503 |
| `TRANSCRIPTION_GROQ_API_KEY` | não | chave do Groq para o microfone do chat (pacote `@adatechnology/audio-transcription-provider`); sem ela só `POST /v1/chat/transcriptions` responde 503 |
| `GOOGLE_CLIENT_ID` | sim | identificador público; sem provedor nenhum a API **recusa subir** |
| `APPLE_CLIENT_ID` | não | `D7` ainda aberta; a recomendação é só Google no lançamento |
| `NODE_ENV` | já vem `production` na imagem | é o que liga `Secure` no cookie |
| `API_PORT` | não | padrão 3000 |
| `WEB_ORIGINS` | **sim** | a URL pública da web. Mesmo com mesma origem o navegador manda `Origin` no POST e a web repassa; vazia, a API recusa todo login com 403 |
| `PANEL_JWT_SECRET` | não | mínimo 32 caracteres, **diferente** do `AUTH_JWT_SECRET`. Liga o painel da equipe (app `apps/painel-paternar`, serviço `painel` em `painel.paternar.com.br`, rotas `/v1/panel`); vazia, o painel não sobe e o resto da API segue igual |
| `PANEL_ADMIN_EMAIL` | não | e-mail do primeiro admin do painel, criado no boot se ainda não existir; aceita vários separados por vírgula (todos admin, mesma senha inicial) |
| `PANEL_ADMIN_PASSWORD` | não | senha desse primeiro admin, mínimo 8 caracteres; troque depois do primeiro acesso |
| `PANEL_ADMIN_RESET` | não | padrão `1`: a cada boot, `PANEL_ADMIN_PASSWORD` vira a senha dos e-mails de `PANEL_ADMIN_EMAIL`. Use `0` para a senha passar a ser só a trocada no painel |

As três entram de uma vez, sem o segredo passar pelo terminal:
`make painel-railway EMAIL=voce@exemplo.com` (ou `GERAR=1` para gerar a senha num arquivo só seu).

`AUTH_DEV_SIGN_IN` **não existe em produção**: com `NODE_ENV=production` o boot
recusa. Isso é proposital (fail-closed, `security.md` §2).

### Web (variáveis de execução)

| nome | obrigatória | observação |
|---|---|---|
| `API_ORIGIN` | sim | endereço **interno** da API; sem ela o processo falha no boot |
| `WEB_PORT` | não | padrão 8080 |

### Web (argumentos de **build** — o Vite assa no bundle)

| nome | observação |
|---|---|
| `APP_ENV` | `web.md` §12: ausente ou desconhecido cai em `production` |
| `GOOGLE_CLIENT_ID` | público por natureza; o navegador o lê no bundle |
| `APPLE_CLIENT_ID` | idem |

**Segredo nunca vira `--build-arg`** — ele fica gravado na camada da imagem.

## 5. HTTPS e cabeçalhos

A imagem da web carimba os seis cabeçalhos em tudo o que ela mesma produz —
`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy`. O repasse de
`/v1` sai **intacto**: a API já traz os dela, e uma CSP de documento colada em
JSON só confunde quem for depurar.

O TLS é terminado pelo provedor. Ligue o redirecionamento dele mesmo assim
(`force_https = true` no Fly; ligado por padrão no Railway): a imagem também
desvia com **308** quando o proxy diz `x-forwarded-proto: http`, mas isso é
cinto sobre suspensório — o desvio da borda evita a primeira viagem em texto
puro, que é onde o cookie escaparia.

`Strict-Transport-Security` vai com `max-age=31536000; includeSubDomains` e
**sem `preload`**: entrar na lista de pré-carga dos navegadores não tem volta
rápida, e isso se decide com o domínio definitivo na mão.

Detalhes e a dívida do `style-src` estão em `docs/SECURITY.md` (`S-005`).

## 6. `D6` fechou: **Railway**

O dono do projeto escolheu Railway. A recomendação escrita no `GOAL.md` era
Fly.io, e o único argumento a favor dela era a região `gru` (São Paulo).

| item | medido em 05/09/2026 |
|---|---|
| `flyctl` | **não instalado**; `~/.fly` não existe — exigiria instalar, criar conta e cadastrar cartão |
| `railway` | **instalado e autenticado** na conta do dono do projeto |
| região | o Railway **não tem região na América do Sul** — Holanda, EUA e Singapura. `us-east4-eqdc4a` é o mais perto do Brasil que existe lá |
| domínio | `web-production-1d6f.up.railway.app`, cunhado por `railway domain --service web --port 8080` |

A latência sul-americana era o argumento do Fly, e ele morreu na escolha do
provedor — não adianta repeti-lo aqui. Domínio próprio, quando houver, entra
como `customDomains` e não muda mais nada do desenho.

## 7. A produção é declarada em código

`.railway/railway.ts` descreve os três recursos, e `railway config plan` compara
o arquivo com o ambiente vivo antes de tocar em nada. Painel clicado não tem
diferença para mostrar, não entra em revisão e não se refaz num ambiente novo —
é a mesma razão que tirou o `drizzle-kit push` do caminho (§2).

```bash
railway config plan          # mostra a diferença
railway config apply --yes   # aplica
railway up --service api --ci
railway up --service web --ci
```

### O deploy automático (GitHub Actions)

`.github/workflows/deploy.yml` faz, a cada push na `main`, o mesmo que os
comandos acima: `make validate ENV=test`, constrói as duas imagens e roda
`railway up --service api --ci` e depois `--service web --ci`. Em PR roda só a
validação e as imagens. A api vai antes porque o pre-deploy dela aplica as
migrations.

O que o workflow precisa, e que não mora no repositório:

| onde | o quê |
|---|---|
| Railway → projeto → *Settings* → *Tokens* | um **token de projeto** no ambiente `production` |
| GitHub → *Settings* → *Environments* | ambiente `production` com o segredo `RAILWAY_TOKEN` |
| idem, em *Variables* | `RAILWAY_PUBLIC_URL`, o endereço público da web (opcional: sem ela a fumaça não roda) |

Para cadastrar os dois de uma vez (precisa do `gh` autenticado):

```bash
make github-railway TOKEN_FILE=caminho/do/token URL=https://...
```

O token decide em qual conta/workspace do Railway o app sobe. O projeto precisa
ter os serviços `api` e `web` (e o Postgres) — `.railway/railway.ts` os descreve.

O `railway config plan/apply` continua manual: mudança de infraestrutura passa
por revisão humana antes de tocar a produção.

### Três defeitos que só o deploy encontrou

Nenhum deles aparece em teste local, e nenhuma das três mensagens de erro
apontava para a causa. Os três viraram teste antes de virar conserto.

| o que quebrou | a mensagem que apareceu | a causa |
|---|---|---|
| a imagem publicada era a de **backup** | `Can't find meta/_journal.json file` | `docker build` sem `--target` constrói o **último** estágio, e o `backup` estava no fim. Ele não carrega `drizzle` |
| o health check falhou **10 vezes em 5 minutos** com o processo vivo | `service unavailable` | não existia variável `PORT` no serviço, e sem domínio o provedor não sabia para onde sondar |
| — | — | `Bun.serve` liga em `0.0.0.0` (só IPv4) e a rede privada do Railway é IPv6; corrigido para `::` antes de a causa real aparecer, e mantido por ser o certo |

O primeiro é o mais traiçoeiro: **a ordem dos estágios do `Dockerfile` é uma
decisão de produção escrita onde ela não parece uma.** Está protegida por
`apps/api-pai-presente/src/config/dockerfile-stages.test.ts`.

### O que o `plan` acusa e não é deriva

Logo depois de um `apply` bem-sucedido, o `plan` volta a listar cinco mudanças:
`source.type`, `deploy.region` e `deploy.restartPolicyType` dos dois serviços, e
`AUTH_JWT_SECRET`. A API do provedor devolve `null` nesses campos, então o
planejador não consegue ver o que ele mesmo acabou de gravar.

O `AUTH_JWT_SECRET` foi **medido**, não suposto: hash `87884204ee82` antes do
`apply` e `87884204ee82` depois. Ele não é rotacionado, e ninguém é deslogado.
Fosse o contrário, todo `apply` derrubaria a sessão de todos os pais.

### O aceite de `F4.2`, medido

| o que | resultado em 05/09/2026 |
|---|---|
| `GET /` na URL pública | `200`, o HTML da tela |
| `GET /health` na URL pública | `200 {"data":{"status":"ok"}}` — o da **web** |
| `GET /v1/activities` na URL pública | `401 UNAUTHENTICATED`, no envelope da **API** — é isto que prova o repasse pela rede privada |
| `GET /health` dentro do contêiner da API | `{"data":{"status":"ok","database":"ok"}}` |
| migrations | 14 tabelas no schema `public` (6 migrations), aplicadas pelo pre-deploy |
| foto e exame no histórico | `201` no envio, `200` na leitura com sha256 idêntico, e os **mesmos ids** respondendo `200` depois de um redeploy trocar o contêiner (07/09/2026) |

O `/health` público é o da web, não o da API: a web tem o dela e o caminho é o
mesmo. Quem prova o banco é o health check interno do provedor, que faz
`select 1` a cada sondagem — e é ele que impede um deploy quebrado de ser
promovido.

### O disco de mídia, e a região que não é detalhe

Foto e exame moram num **volume** montado em `/data`, e `MEDIA_DIRECTORY` aponta
para `/data/media`. O disco tem 5 GB provisionados a ≈US$ 0,16/GB/mês — cobra-se
o provisionado, não o usado.

**Volume e contêiner têm de estar na MESMA região.** O Railway não monta disco de
outra região: em 07/09/2026 o volume nasceu em `sfo` enquanto a api e o Postgres
estão em `us-east4-eqdc4a`, e o resultado foi volume `ERROR` com `currentSizeMB 0`,
dois deploys falhados e `/data` caindo no overlay efêmero do contêiner — o
histórico gravava num disco que morre no próximo deploy.

O que torna esta falha perigosa é que **`/health` respondeu 200 o tempo todo**.
Nada do que o deploy verifica olha para o disco. Quem impede a volta é
`.railway/railway.test.ts`, que afirma volume anexado na região de quem monta e
banco na região de quem consulta.

Mover volume de região é **apagar e recriar**: `volumeInstanceUpdate` aceita só
`mountPath`, `serviceId` e `state`, e `region` entra apenas em `volumeCreate` —
que não aceita nome, o Railway cunha. Como o volume apagado segura o nome por
dois dias de carência, o mesmo disco passou por três nomes (`api-volume` →
`api-volume-cs8b` → `api-volume-_R9v`). O arquivo de IaC declara o nome que a
produção tem hoje: sem isso o `config plan` propõe **desanexar e apagar** o disco.

Mexer no serviço não resolve. `serviceInstanceUpdate` respondeu `true` duas vezes
sem mover o contêiner, e o Railway desfez o conflito por conta dele puxando o
*volume* para oeste — o que devolve o pulo de costa a costa até o banco
(~65 ms por consulta medidos, contra ~1–3 ms na rede interna da mesma região).

### O `ENTRYPOINT` existe por causa do dono do volume

Volume do Railway monta **com o dono `root`**. A imagem do Bun roda como `bun`,
então sem intervenção o primeiro `write` em `/data/media` falha por permissão —
e falha *depois* do deploy ser promovido, no primeiro envio de um pai.

O `ENTRYPOINT` da API roda como `root`, cria `MEDIA_DIRECTORY`, faz `chown`, e só
então entrega o processo com `exec su-exec bun "$@"`. Verificado em produção:
`/data/media` com dono `bun bun`. Não é conveniência — é o que faz o disco ser
gravável, e o teste que o cobre é o envio ponta a ponta na tabela de aceite acima.

### Como se entra hoje, e o que continua fechado

**A porta é e-mail e senha** (`AUTH_PASSWORD_SIGN_IN=1`, o padrão do schema).
Ela não depende de terceiro nenhum, e conta como porta na checagem fail-closed
do boot — a produção configurada só com senha sobe.

`GOOGLE_CLIENT_ID` fica **vazio** até `D7`. Vazio é a única forma honesta de
dizer "não existe client_id": qualquer valor, inclusive o marcador
`AGUARDANDO-D7` que ficou aqui até 06/09, é verdadeiro, e verdadeiro manda a
tela baixar o SDK do Google, que recusa o identificador inválido e deixa um
buraco onde deveria haver botão.

Quando `D7` chegar, o único passo é trocar `GOOGLE_CLIENT_ID` nos dois serviços
(`api` e `web`) pelo identificador real — `F5.1` já tem o resto pronto.

## 8. O backup — ainda não agendado

O alvo de backup **não sobe na imagem da API**. `pg_dump` não existe na imagem
oficial do Bun, e instalar `postgresql-client` no serviço que atende HTTP
engordaria a superfície de toda requisição por causa de um trabalho que roda uma
vez por dia. O `Dockerfile` da API tem um estágio `backup` só para isso:

```bash
docker build -f apps/api-pai-presente/Dockerfile --target backup -t pai-presente-backup .
```

Medido em 05/09/2026 dentro da imagem: `pg_dump 17.11`, `psql 17.11`, e
`bun dist/backup/run-backup.js` chega à validação de ambiente. A versão do
cliente **acompanha a do servidor** — `pg_dump` mais velho que o banco recusa o
dump, e essa recusa só apareceria na primeira execução agendada.

O caminho é `dist/backup/run-backup.js`, não `dist/run-backup.js`: com várias
entradas o `bun build` preserva o caminho relativo à raiz comum. Escrito errado,
a imagem constrói, sobe, e só falha no primeiro agendamento.

### Agendamento

| item | valor |
|---|---|
| frequência | diária, fora do horário de pico |
| comando | `bun dist/backup/run-backup.js` |
| restauração | `bun dist/backup/run-restore.js [chave-do-objeto]` — sem argumento, o mais recente |
| onde | um serviço de cron no Railway apontando para o estágio `backup` do mesmo `Dockerfile` |

### Variáveis do trabalho de backup

| variável | valor em produção |
|---|---|
| `DATABASE_URL` | o endereço **privado** do Postgres, o mesmo da API |
| `BACKUP_DESTINATION` | `s3` |
| `BACKUP_S3_BUCKET` / `BACKUP_S3_ENDPOINT` | o balde privado e o endpoint do provedor |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | credencial **só deste balde**, e diferente da de staging (`security.md` §7) |
| `BACKUP_ENCRYPTION_KEY` | 32 bytes em base64, **guardados fora do balde** |
| `BACKUP_ENVIRONMENT` | `production` — entra no nome do objeto e separa os ambientes dentro do balde |

### A guarda da chave

A chave de cifra **não pode viver no mesmo lugar que o cifrado**: com as duas
juntas, o vazamento do balde é o vazamento do banco inteiro. Ela é variável selada do
Railway, nunca
`--build-arg` — argumento de build fica assado na camada da imagem, legível por
quem puxar a imagem.

Gerar: `openssl rand -base64 32`. **Perder a chave é perder todos os backups
cifrados com ela** — não há recuperação, é AES-256-GCM. Guardar uma cópia no
cofre de senhas do dono do projeto é pré-requisito do primeiro backup.

### O restore precisa ser ensaiado no ambiente publicado

`make backup-proof` prova o ciclo **localmente** (§ *Backup cifrado* em
`SECURITY.md`). Ele não prova a rede, a credencial do balde nem a chave em
produção. O primeiro backup publicado tem de ser restaurado num banco
descartável antes de alguém considerar a produção protegida: backup que nunca
voltou não é backup, é esperança.
