/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

/**
 * O piso da senha e' o MESMO da API (`PASSWORD_MIN_LENGTH`, ASVS L2). A copia
 * existe porque nao ha pacote compartilhado entre a app TypeScript e esta, e
 * quem impede as duas de divergirem e' `sign-in-form.test.js`, que le a
 * constante da API e compara. Duas copias sem essa amarra concordam ate a
 * primeira edicao, e o sintoma seria o pai digitando uma senha que a tela
 * aceita e o servidor recusa.
 */
export const PASSWORD_MIN_LENGTH = 12;

export const SIGN_IN_MODES = Object.freeze({
  SIGN_IN: 'signIn',
  REGISTER: 'register',
});

/**
 * Os botoes de "reservar vaga" da vitrine levam a `app.../?cadastro=1`: quem
 * chega por ali ainda nao tem conta, e abrir na aba de entrar faria o pai
 * procurar onde se cadastra.
 */
export function initialSignInMode(search = '') {
  return new URLSearchParams(search).has('cadastro') ? SIGN_IN_MODES.REGISTER : SIGN_IN_MODES.SIGN_IN;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * O sufixo `Key` nao e enfeite: `i18n-keys.test.js` varre o codigo-fonte por
 * `t('...')` e por `<algo>Key: '...'`. Chave que chega a tela por caminho que a
 * varredura nao ve pode nao existir no arquivo de traducao, e o sintoma e' a
 * chave crua desenhada no lugar da frase, sem nada quebrar.
 */
const PROBLEM_KEYS = Object.freeze({
  emailKey: 'signIn.errors.email',
  passwordRequiredKey: 'signIn.errors.passwordRequired',
  passwordShortKey: 'signIn.errors.passwordShort',
});

/**
 * Recusa no CAMPO, antes do envio: sem isto o pai descobre a senha curta pelo
 * 400 da API, que chega depois de ele ter preenchido tudo. A checagem daqui e'
 * conveniencia — quem decide continua sendo o schema do servidor.
 *
 * Devolve CHAVE de traducao por campo, nunca a frase: a frase mora no
 * `.locale.json`, e montar texto aqui furaria `web.md` §6.
 *
 * @param {{ email?: string, password?: string, mode?: string }} form
 * @returns {Readonly<Record<string, string>>}
 */
export function describeCredentialProblems({ email = '', password = '', mode = SIGN_IN_MODES.SIGN_IN }) {
  const problems = {};

  if (!EMAIL_PATTERN.test(email.trim())) problems.email = PROBLEM_KEYS.emailKey;

  /**
   * Entrando, senha curta e' so senha errada — cobrar o piso ali acusaria de
   * "curta" a senha que o pai criou antes de o piso existir, e ele nao tem como
   * consertar isso digitando melhor.
   */
  if (password === '') problems.password = PROBLEM_KEYS.passwordRequiredKey;
  else if (mode === SIGN_IN_MODES.REGISTER && password.length < PASSWORD_MIN_LENGTH) {
    problems.password = PROBLEM_KEYS.passwordShortKey;
  }

  return Object.freeze(problems);
}

/**
 * O e-mail viaja SEM espaco em volta e em minuscula, como a API o normaliza
 * antes de validar. Mandar " Ana@X.com " faria o cadastro nascer com um
 * endereco e o login procurar por outro.
 *
 * @param {{ email: string, password: string, fullName?: string }} form
 */
export function toCredentials({ email, password, fullName = '' }) {
  return { email: email.trim().toLowerCase(), password, fullName: fullName.trim() };
}
