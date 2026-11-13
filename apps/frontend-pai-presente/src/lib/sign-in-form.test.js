/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  describeCredentialProblems,
  initialSignInMode,
  PASSWORD_MIN_LENGTH,
  SIGN_IN_MODES,
  toCredentials,
} from './sign-in-form';

const SHORT = 'a'.repeat(PASSWORD_MIN_LENGTH - 1);
const LONG = 'a'.repeat(PASSWORD_MIN_LENGTH);
const EMAIL = 'pai@example.com';

/**
 * `packages/` esta vazio: nao ha pacote compartilhado entre a app TypeScript e
 * esta, entao o piso da senha existe duas vezes. Quem impede as duas de
 * divergirem e' este teste — ele LE a constante da API e compara.
 *
 * Divergir para BAIXO e' o caso perigoso: o formulario aceitaria uma senha que
 * a API recusa, e o pai levaria um 400 depois de preencher tudo, sem entender
 * por que o campo que ele acabou de validar deu errado.
 */
describe('o piso da senha e o mesmo dos dois lados', () => {
  const API_CONSTANT = readFileSync(
    join(import.meta.dir, '../../../api-pai-presente/src/modules/Auth/auth.constant.ts'),
    'utf8',
  );

  test('a API declara o piso que esta app repete', () => {
    const declared = /export const PASSWORD_MIN_LENGTH = (\d+);/.exec(API_CONSTANT);
    expect(declared).not.toBeNull();
    expect(Number(declared[1])).toBe(PASSWORD_MIN_LENGTH);
  });
});

describe('describeCredentialProblems', () => {
  test('credencial completa nao acusa nada', () => {
    expect(describeCredentialProblems({ email: EMAIL, password: LONG })).toEqual({});
  });

  test('e-mail sem arroba e acusado no campo do e-mail', () => {
    const problems = describeCredentialProblems({ email: 'pai', password: LONG });
    expect(problems.email).toBe('signIn.errors.email');
    expect(problems.password).toBeUndefined();
  });

  test('e-mail com espaco em volta continua valido', () => {
    expect(describeCredentialProblems({ email: `  ${EMAIL} `, password: LONG })).toEqual({});
  });

  test('senha em branco e acusada nos dois modos', () => {
    const entrando = describeCredentialProblems({ email: EMAIL, password: '' });
    const cadastrando = describeCredentialProblems({
      email: EMAIL,
      password: '',
      mode: SIGN_IN_MODES.REGISTER,
    });
    expect(entrando.password).toBe('signIn.errors.passwordRequired');
    expect(cadastrando.password).toBe('signIn.errors.passwordRequired');
  });

  /**
   * O piso e' regra de quem CRIA a senha. Cobra-lo na entrada acusaria de
   * "curta" a senha de quem cadastrou antes de o piso subir — e a pessoa nao
   * tem como consertar isso do lado de fora.
   */
  test('senha curta so e problema no cadastro', () => {
    expect(describeCredentialProblems({ email: EMAIL, password: SHORT }).password).toBeUndefined();
    expect(
      describeCredentialProblems({ email: EMAIL, password: SHORT, mode: SIGN_IN_MODES.REGISTER })
        .password,
    ).toBe('signIn.errors.passwordShort');
  });

  test('os dois campos errados aparecem juntos, nao um por vez', () => {
    const problems = describeCredentialProblems({
      email: 'pai',
      password: SHORT,
      mode: SIGN_IN_MODES.REGISTER,
    });
    expect(Object.keys(problems).sort()).toEqual(['email', 'password']);
  });

  /** O que a tela desenha e' chave de traducao (`web.md` §6), nunca frase. */
  test('o problema e chave de traducao com escopo', () => {
    const problems = describeCredentialProblems({ email: 'pai', password: '' });
    Object.values(problems).forEach((key) => expect(key.startsWith('signIn.')).toBe(true));
  });
});

describe('toCredentials', () => {
  /**
   * A API normaliza antes de validar e guarda em minuscula. Mandar
   * `Pai@Example.com` daqui produziria um 401 na entrada e um 409 no cadastro,
   * ambos sem explicacao visivel.
   */
  test('o e-mail viaja aparado e em minuscula', () => {
    expect(toCredentials({ email: '  Pai@Example.COM ', password: LONG }).email).toBe(EMAIL);
  });

  /** A senha NAO e aparada: espaco na ponta e caractere que o dono digitou. */
  test('a senha viaja como foi digitada', () => {
    expect(toCredentials({ email: EMAIL, password: ' senha com espaco ' }).password).toBe(
      ' senha com espaco ',
    );
  });

  test('o nome vem aparado, e some quando so tinha espaco', () => {
    expect(toCredentials({ email: EMAIL, password: LONG, fullName: '  Ana  ' }).fullName).toBe('Ana');
    expect(toCredentials({ email: EMAIL, password: LONG, fullName: '   ' }).fullName).toBe('');
  });
});

describe('a vitrine abre o app direto no cadastro', () => {
  test('?cadastro abre a aba de criar conta', () => {
    expect(initialSignInMode('?cadastro=1')).toBe(SIGN_IN_MODES.REGISTER);
  });

  test('sem o parametro, abre na aba de entrar', () => {
    expect(initialSignInMode('')).toBe(SIGN_IN_MODES.SIGN_IN);
    expect(initialSignInMode('?outra=1')).toBe(SIGN_IN_MODES.SIGN_IN);
  });
});
