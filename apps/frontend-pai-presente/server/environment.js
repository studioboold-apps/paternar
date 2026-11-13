/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { readAdsenseClientId, readAdvertisingClientId } from './advertising.js';
import { readLandingHosts } from './landing.js';

const DEFAULT_PORT = 8080;
const DEFAULT_DIST_DIRECTORY = 'dist';

/**
 * Falha no BOOT, nunca na primeira chamada (`nodejs.md`): sem `API_ORIGIN` a
 * imagem subiria saudavel, serviria a tela e devolveria erro so quando o pai
 * tentasse entrar — e o painel do provedor mostraria tudo verde.
 *
 * @param {Record<string, string | undefined>} source
 */
export function readServerEnvironment(source) {
  const apiOrigin = (source.API_ORIGIN ?? '').trim();
  if (apiOrigin.length === 0) throw new Error('API_ORIGIN nao definido');

  const rawPort = (source.WEB_PORT ?? '').trim();
  const port = rawPort.length === 0 ? DEFAULT_PORT : Number(rawPort);
  if (!Number.isInteger(port) || port <= 0) throw new Error(`WEB_PORT invalido: ${rawPort}`);

  const distDirectory = (source.WEB_DIST_DIR ?? '').trim();

  /**
   * Vitrine ligada sem o endereco do app desviaria o pai para lugar nenhum: a
   * imagem nao sobe, e o deploy anterior continua no ar (`landing.js`).
   */
  const landingHosts = readLandingHosts(source.LANDING_HOSTS);
  const appUrl = (source.APP_URL ?? '').trim();
  if (landingHosts.size > 0 && !/^https?:\/\/[^/]+/.test(appUrl)) {
    throw new Error('LANDING_HOSTS pede APP_URL (ex.: https://app.paternar.com.br)');
  }

  return {
    apiOrigin,
    port,
    distDirectory: distDirectory.length === 0 ? DEFAULT_DIST_DIRECTORY : distDirectory,
    /** Vazio = sem anuncio: `ADS_ENABLED` desligado ou ausente. */
    adsenseClientId: readAdvertisingClientId(source),
    /**
     * O id cadastrado, com ou sem `ADS_ENABLED`: o `ads.txt` declara a conta
     * ANTES de ligar, para o Google verificar o site sem anuncio na tela.
     */
    adsensePublisherId: readAdsenseClientId(source.ADSENSE_CLIENT_ID),
    landingHosts,
    appUrl,
  };
}
