/**
 * Pai Presente — API
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.interface';
import type { AuthProvider, PASSWORD_AUTH_PROVIDER, TokenAuthProvider } from '../auth.constant';

export type ProviderIdentity = {
  readonly subject: string;
  readonly email: string;
  readonly fullName: string | undefined;
};

export type IdentityVerifier = {
  verify(idToken: string): Promise<ProviderIdentity>;
};

export type IdentityVerifierRegistry = {
  /** Senha nao entra aqui: verificador le prova EXTERNA, nunca o nosso banco. */
  forProvider(provider: TokenAuthProvider): IdentityVerifier | undefined;
};

export type FindOrCreateAccountParams = {
  readonly provider: AuthProvider;
  readonly identity: ProviderIdentity;
};

export type AuthAccountRepository = {
  findOrCreateByIdentity(params: FindOrCreateAccountParams): Promise<AuthenticatedUser>;
  /** A sessao cai junto com o usuario (`ON DELETE CASCADE`), entao ele existe. */
  findById(userId: string): Promise<AuthenticatedUser>;
  /** Bloqueado pela equipe no painel (`users.blocked_at` preenchido). */
  isBlocked(userId: string): Promise<boolean>;
};

export type SessionRecord = {
  readonly id: string;
  readonly userId: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
};

export type CreateSessionParams = {
  readonly userId: string;
  readonly refreshTokenHash: string;
  readonly expiresAt: Date;
};

export type SessionRepository = {
  findByRefreshTokenHash(refreshTokenHash: string): Promise<SessionRecord | undefined>;
  insert(params: CreateSessionParams): Promise<SessionRecord>;
  revokeById(sessionId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
};

export type RefreshToken = {
  readonly value: string;
  readonly hash: string;
};

export type TokenService = {
  mintAccessToken(user: AuthenticatedUser): Promise<string>;
  verifyAccessToken(accessToken: string): Promise<AuthenticatedUser | undefined>;
  issueRefreshToken(): RefreshToken;
  hashRefreshToken(refreshTokenValue: string): string;
};

/** O que a rota precisa devolver para o navegador guardar a sessao. */
export type IssuedSession = {
  readonly user: AuthenticatedUser;
  readonly accessToken: string;
  readonly refreshTokenValue: string;
};

export type VerifyPasswordParams = {
  readonly password: string;
  /** Indefinido e o caso do e-mail sem senha — ele tambem paga o `verify`. */
  readonly passwordHash: string | undefined;
};

export type PasswordHasher = {
  hash(password: string): Promise<string>;
  verify(params: VerifyPasswordParams): Promise<boolean>;
};

export type CreatePasswordAccountParams = {
  readonly email: string;
  readonly fullName: string | undefined;
  readonly passwordHash: string;
};

export type PasswordCredential = {
  readonly user: AuthenticatedUser;
  readonly passwordHash: string | undefined;
};

export type PasswordAccountRepository = {
  create(params: CreatePasswordAccountParams): Promise<AuthenticatedUser>;
  findCredentialByEmail(email: string): Promise<PasswordCredential | undefined>;
};

export type TokenSignInParams = {
  readonly provider: TokenAuthProvider;
  readonly idToken: string;
};

export type PasswordSignInParams = {
  readonly provider: typeof PASSWORD_AUTH_PROVIDER;
  readonly email: string;
  readonly password: string;
};

export type SignInParams = TokenSignInParams | PasswordSignInParams;

export type RegisterWithPasswordParams = {
  readonly email: string;
  readonly password: string;
  readonly fullName: string | undefined;
};

export type AuthUseCases = {
  signIn(params: SignInParams): Promise<IssuedSession>;
  registerWithPassword(params: RegisterWithPasswordParams): Promise<IssuedSession>;
  refreshSession(refreshTokenValue: string): Promise<IssuedSession>;
  signOut(refreshTokenValue: string): Promise<void>;
};
