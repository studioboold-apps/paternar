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

// O #60 apagou o `ensureAdsenseAccount` e manteve a chamada: o deploy so quebrou
// em producao. Toda funcao chamada com `await` no script tem de existir nele.
describe('o script de servicos nao chama funcao inexistente', () => {
  test('cada `await nome(` tem a sua declaracao', async () => {
    const source = await Bun.file(new URL('./railway-garantir-servicos.mjs', import.meta.url)).text();
    const called = new Set([...source.matchAll(/await\s+([a-zA-Z_$][\w$]*)\(/g)].map((m) => m[1]));
    const declared = new Set([...source.matchAll(/function\s+([a-zA-Z_$][\w$]*)\s*\(/g)].map((m) => m[1]));
    const builtins = new Set(['fetch']);
    const missing = [...called].filter((name) => !declared.has(name) && !builtins.has(name));
    expect(missing).toEqual([]);
  });
});
