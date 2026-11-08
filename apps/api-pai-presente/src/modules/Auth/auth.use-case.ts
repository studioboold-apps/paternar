/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import type { AuthenticatedUser } from '../shared/auth/authenticated-user.interface';
import {
  IdentityTokenInvalidError,
  ProviderNotConfiguredError,
  RefreshTokenInvalidError,
  UserBlockedError,
} from './auth.error';
import { PASSWORD_AUTH_PROVIDER, REFRESH_TOKEN_TTL_SECONDS } from './auth.constant';
import type {
  AuthAccountRepository,
  AuthUseCases,
  IdentityVerifierRegistry,
  IssuedSession,
  PasswordAccountRepository,
  PasswordHasher,
  PasswordSignInParams,
  RegisterWithPasswordParams,
  SessionRecord,
  SessionRepository,
  SignInParams,
  TokenService,
  TokenSignInParams,
} from './types/auth.types';

/** O nome que o pai le na recusa, quando a entrada por senha esta desligada. */
const PASSWORD_PROVIDER_LABEL = 'e-mail e senha';

export type CreateAuthUseCasesParams = {
  readonly verifiers: IdentityVerifierRegistry;
  readonly accounts: AuthAccountRepository;
  readonly passwordAccounts: PasswordAccountRepository;
  readonly passwordHasher: PasswordHasher;
  readonly isPasswordSignInEnabled: boolean;
  readonly sessions: SessionRepository;
  readonly tokenService: TokenService;
};

export function createAuthUseCases({
  verifiers,
  accounts,
  passwordAccounts,
  passwordHasher,
  isPasswordSignInEnabled,
  sessions,
  tokenService,
}: CreateAuthUseCasesParams): AuthUseCases {
  // Todo caminho que abre sessao passa aqui: login por senha, por Google/Apple e
  // renovacao. Barrar num lugar so e' o que garante que nenhum deles escapa.
  async function issueSession(user: AuthenticatedUser): Promise<IssuedSession> {
    if (await accounts.isBlocked(user.userId)) {
      await sessions.revokeAllForUser(user.userId);
      throw new UserBlockedError();
    }
    const refreshToken = tokenService.issueRefreshToken();
    await sessions.insert({
      userId: user.userId,
      refreshTokenHash: refreshToken.hash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    });
    return {
      user,
      accessToken: await tokenService.mintAccessToken(user),
      refreshTokenValue: refreshToken.value,
    };
  }

  // Refresh apresentado depois de revogado e sinal de token roubado: quem tem o
  // valor antigo nao e mais o dono legitimo, entao TODAS as sessoes caem.
  async function assertSessionIsUsable(session: SessionRecord): Promise<void> {
    if (session.revokedAt !== null) {
      await sessions.revokeAllForUser(session.userId);
      throw new RefreshTokenInvalidError();
    }
    if (session.expiresAt.getTime() <= Date.now()) throw new RefreshTokenInvalidError();
  }

  async function signInWithToken({ provider, idToken }: TokenSignInParams): Promise<IssuedSession> {
    const verifier = verifiers.forProvider(provider);
    if (verifier === undefined) throw new ProviderNotConfiguredError(provider);

    const identity = await verifier.verify(idToken);
    const user = await accounts.findOrCreateByIdentity({ provider, identity });
    return await issueSession(user);
  }

  function assertPasswordSignInIsEnabled(): void {
    if (!isPasswordSignInEnabled) throw new ProviderNotConfiguredError(PASSWORD_PROVIDER_LABEL);
  }

  /**
   * A recusa e SEMPRE a mesma, venha ela de e-mail que nao existe, de conta sem
   * senha (entrou por Google) ou de senha errada. Distinguir aqui entregaria a
   * lista de quem tem conta a qualquer um com um formulario e uma tarde.
   */
  async function signInWithPassword({ email, password }: PasswordSignInParams): Promise<IssuedSession> {
    assertPasswordSignInIsEnabled();

    const credential = await passwordAccounts.findCredentialByEmail(email);
    const isCorrect = await passwordHasher.verify({
      password,
      passwordHash: credential?.passwordHash,
    });
    if (!isCorrect || credential === undefined) throw new IdentityTokenInvalidError();
    return await issueSession(credential.user);
  }

  return {
    async signIn(params: SignInParams): Promise<IssuedSession> {
      if (params.provider === PASSWORD_AUTH_PROVIDER) return await signInWithPassword(params);
      return await signInWithToken(params);
    },

    /**
     * Cadastrar ja abre a sessao. Mandar a pessoa preencher e-mail e senha de
     * novo, na tela ao lado, e pedir duas vezes a mesma coisa pelo prazer de
     * separar as rotas.
     */
    async registerWithPassword({
      email,
      password,
      fullName,
    }: RegisterWithPasswordParams): Promise<IssuedSession> {
      assertPasswordSignInIsEnabled();

      const passwordHash = await passwordHasher.hash(password);
      const user = await passwordAccounts.create({ email, fullName, passwordHash });
      return await issueSession(user);
    },

    async refreshSession(refreshTokenValue: string): Promise<IssuedSession> {
      const hash = tokenService.hashRefreshToken(refreshTokenValue);
      const session = await sessions.findByRefreshTokenHash(hash);
      if (session === undefined) throw new RefreshTokenInvalidError();

      await assertSessionIsUsable(session);
      await sessions.revokeById(session.id);
      return await issueSession(await accounts.findById(session.userId));
    },

    async signOut(refreshTokenValue: string): Promise<void> {
      const hash = tokenService.hashRefreshToken(refreshTokenValue);
      const session = await sessions.findByRefreshTokenHash(hash);
      if (session !== undefined) await sessions.revokeById(session.id);
    },
  };
}
