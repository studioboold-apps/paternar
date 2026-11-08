/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import type {
  AuthenticatedUser,
  AuthenticatedUserResolver,
} from '../shared/auth/authenticated-user.interface';
import { ACCESS_COOKIE_NAME } from './auth.constant';
import { readCookie } from './cookie.util';
import type { AuthAccountRepository, TokenService } from './types/auth.types';

/**
 * O COOKIE e a unica origem da sessao. Aceitar tambem `Authorization: Bearer`
 * daria ao frontend um caminho para guardar o token em `localStorage`, que e
 * exatamente o que a decisao de cookie veio impedir.
 */
export function createCookieSessionResolver(
  tokenService: TokenService,
  accounts: Pick<AuthAccountRepository, 'isBlocked'>,
): AuthenticatedUserResolver {
  return {
    async resolve(request: Request): Promise<AuthenticatedUser | undefined> {
      const accessToken = readCookie(request, ACCESS_COOKIE_NAME);
      if (accessToken === undefined) return undefined;
      const user = await tokenService.verifyAccessToken(accessToken);
      if (user === undefined) return undefined;
      // O token de acesso vale 15 minutos; sem esta consulta, o pai bloqueado
      // seguiria usando o app ate ele vencer. Bloqueado conta como sem sessao.
      if (await accounts.isBlocked(user.userId)) return undefined;
      return user;
    },
  };
}
