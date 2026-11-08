/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

const ADSENSE_CLIENT_ID_PATTERN = /^ca-pub-\d{10,20}$/;

/**
 * A metatag `google-adsense-account` e' como o AdSense verifica que o site e'
 * da conta — SEM carregar script nenhum e sem anuncio na tela. Ela entra com o
 * id cadastrado, com ou sem `ADS_ENABLED`, para a revisao do site acontecer
 * antes de ligar.
 *
 * @param {string | undefined} clientId
 */
export function buildAdsenseAccountMeta(clientId) {
  const value = String(clientId ?? '').trim();
  if (!ADSENSE_CLIENT_ID_PATTERN.test(value)) return '';
  return `<meta name="google-adsense-account" content="${value}" />`;
}

export function adsenseAccountPlugin({ clientId }) {
  const meta = buildAdsenseAccountMeta(clientId);

  return {
    name: 'pai-presente:adsense-account',
    transformIndexHtml: (html) => (meta ? html.replace('</head>', `    ${meta}\n  </head>`) : html),
  };
}
