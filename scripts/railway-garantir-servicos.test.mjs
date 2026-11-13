// A vitrine so liga quando o app ja abre em HTTPS no subdominio.
import { describe, expect, test } from 'bun:test';

import { isCertificateValid, mergeOrigins } from './railway-garantir-servicos.mjs';

describe('quando a vitrine pode ligar', () => {
  test('dominio verificado com certificado valido', () => {
    expect(isCertificateValid({ verified: true, certificateStatus: 'CERTIFICATE_STATUS_TYPE_VALID' })).toBe(true);
  });

  test('certificado ainda sendo emitido nao liga', () => {
    expect(isCertificateValid({ verified: true, certificateStatus: 'CERTIFICATE_STATUS_TYPE_ISSUING' })).toBe(false);
  });

  test('dominio sem verificacao, ou recem-criado, nao liga', () => {
    expect(isCertificateValid({ verified: false, certificateStatus: 'CERTIFICATE_STATUS_TYPE_VALID' })).toBe(false);
    expect(isCertificateValid(undefined)).toBe(false);
  });
});

describe('WEB_ORIGINS', () => {
  test('acrescenta a origem do app sem tirar nenhuma', () => {
    const { value, missing } = mergeOrigins('https://paternar.com.br', ['https://paternar.com.br', 'https://app.paternar.com.br']);
    expect(value).toBe('https://paternar.com.br,https://app.paternar.com.br');
    expect(missing).toEqual(['https://app.paternar.com.br']);
  });
});
