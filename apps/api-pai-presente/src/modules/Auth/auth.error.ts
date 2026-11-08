/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { DomainError } from '../shared/errors/app.error';
import { ERROR_CODES } from '../shared/errors/codes';
import { HTTP_STATUS } from '../shared/http/http.constant';

/**
 * A mensagem nao diz POR QUE o token nao serve (expirado, assinatura errada,
 * audiencia de outro app): isso e informacao para quem esta tentando adivinhar.
 */
export class IdentityTokenInvalidError extends DomainError {
  constructor() {
    super({
      code: ERROR_CODES.auth.IDENTITY_TOKEN_INVALID,
      message: 'Login recusado.',
      statusCode: 401,
    });
  }
}

export class RefreshTokenInvalidError extends DomainError {
  constructor() {
    super({
      code: ERROR_CODES.auth.REFRESH_TOKEN_INVALID,
      message: 'Sessao expirada.',
      statusCode: 401,
    });
  }
}

/**
 * So o CADASTRO conta que o e-mail ja existe, e conta porque a alternativa e
 * pior: sem isso, quem se cadastrou por Google e esqueceu tentaria de novo e
 * receberia uma falha muda. O LOGIN continua vago de proposito — la, dizer
 * "essa senha esta errada" confirmaria a conta para quem esta sondando.
 */
export class EmailAlreadyRegisteredError extends DomainError {
  constructor() {
    super({
      code: ERROR_CODES.auth.EMAIL_ALREADY_REGISTERED,
      message: 'Esse e-mail ja tem conta. Entre em vez de criar outra.',
      statusCode: HTTP_STATUS.CONFLICT,
    });
  }
}

/**
 * Conta bloqueada pela equipe. So aparece DEPOIS da prova de identidade (senha
 * certa ou token do Google valido), entao nao serve para sondar quem tem conta.
 */
export class UserBlockedError extends DomainError {
  constructor() {
    super({
      code: ERROR_CODES.auth.USER_BLOCKED,
      message: 'Esta conta esta bloqueada. Fale com o suporte do Entrelacos.',
      statusCode: 403,
    });
  }
}

/** Falha de configuracao do servidor, nao erro de quem chamou. */
export class ProviderNotConfiguredError extends DomainError {
  constructor(provider: string) {
    super({
      code: ERROR_CODES.auth.PROVIDER_NOT_CONFIGURED,
      message: `Login por ${provider} indisponivel.`,
      statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
    });
  }
}
