# Anúncios (Google AdSense)

O Paternar é uma web app (PWA), então o caminho é o **AdSense**. AdMob só
serve para app nativo de loja, que ainda não existe.

## Como liga

Três variáveis no serviço `web` do Railway (`.railway/railway.ts`):

| variável | exemplo | onde achar |
|---|---|---|
| `ADS_ENABLED` | `0` / `1` | o interruptor geral. **Desligado por padrão**: só `1` (ou `true`) liga |
| `ADSENSE_CLIENT_ID` | `ca-pub-1234567890123456` | AdSense → Conta → Informações da conta (ID de editor, com `ca-` na frente) |
| `ADSENSE_SLOT_ID` | `9876543210` | AdSense → Anúncios → Por bloco de anúncios → criar bloco "Display" → `data-ad-slot` |

Com `ADS_ENABLED` diferente de `1`, nenhum anúncio aparece, mesmo com os ids
preenchidos: nenhum bloco e CSP fechada. Só o `ADSENSE_CLIENT_ID` já basta para
o site publicar a metatag `google-adsense-account` e o `/ads.txt`: é assim que o
Google verifica e aprova o domínio antes de ligar os anúncios (método
"Metatag" no AdSense). Isso deixa cadastrar os ids e
validar antes de ligar. `ADS_ENABLED=1` sem `ADSENSE_CLIENT_ID` derruba o boot.

Ligado e com os ids:

- um bloco discreto, rotulado "Publicidade", no fim da **Início** e do feed da **Comunidade**;
- a CSP abre só as origens do Google que o anúncio usa (`script-src` continua sem `'unsafe-inline'`);
- `/ads.txt` responde `google.com, pub-…, DIRECT, f08c47fec0942fa0`;
- fora de produção (`APP_ENV` ≠ `production`) o bloco vai com `data-adtest="on"`, para clique de teste não contar como clique inválido.

O id do cliente é lido no **boot** (CSP e `ads.txt`) e gravado no **build**
(o bloco na tela): mudar a variável pede um novo deploy, não só restart.

## Passo a passo da conta

1. Criar a conta em <https://adsense.google.com> com o domínio público do app.
2. Preencher os ids no Railway com `ADS_ENABLED=0` → deploy (nada aparece ainda).
3. Validar em homologação com `ADS_ENABLED=1` (`APP_ENV=staging`, anúncio em modo de teste).
4. Ligar `ADS_ENABLED=1` em produção → deploy.
5. Pedir a revisão no painel. O robô do Google precisa achar conteúdo e o `/ads.txt` no domínio.
6. Configurar pagamento (dados fiscais, conta bancária). O Google paga a partir de US$ 100 acumulados.

## Cuidados

- **Domínio próprio**: o AdSense costuma recusar `*.up.railway.app`. Um domínio próprio ajuda na aprovação.
- **Conteúdo atrás de login**: a revisão olha o que é público. Uma página inicial pública com conteúdo ajuda.
- **Nunca clicar no próprio anúncio** em produção: isso suspende a conta.
- **LGPD/consentimento**: a política de privacidade precisa citar cookies de publicidade do Google.
