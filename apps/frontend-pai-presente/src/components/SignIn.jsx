/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import React from 'react';
import { LogIn, UserPlus } from 'lucide-react';

import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/AuthContext';
import { useTranslation } from '@/lib/i18n';
import { PASSWORD_MIN_LENGTH, SIGN_IN_MODES } from '@/lib/sign-in-form';
import { useSignIn } from '@/lib/use-sign-in';
import { cn } from '@/lib/utils';

const AppleMark = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
    <path d="M16.365 1.43c0 1.14-.42 2.2-1.26 3.02-.99.99-2.14 1.56-3.31 1.47-.13-1.13.44-2.3 1.24-3.07.9-.87 2.28-1.5 3.33-1.42zM20.7 17.2c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.01-3.05-1.76-4.04-3.32C.13 15.98-.15 10.85 1.86 8.13c1.09-1.49 2.8-2.36 4.42-2.36 1.65 0 2.68 1 4.05 1 1.32 0 2.13-1 4.03-1 1.44 0 2.96.78 4.05 2.14-3.56 1.95-2.98 7.03.29 8.29z" />
  </svg>
);

/**
 * O erro mora no proprio campo (`web.md` §11): `aria-invalid` marca o campo, e
 * `aria-describedby` liga a frase a ele. Texto solto ao lado nao chega ao leitor
 * de tela, que e' exatamente quem nao ve a borda vermelha.
 */
function Field({ id, name, type, label, value, problemKey, hint, autoComplete, onChange }) {
  const { t } = useTranslation();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [problemKey ? errorId : undefined, hint ? hintId : undefined]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        aria-invalid={problemKey ? 'true' : undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        className={cn('min-h-11', problemKey && 'border-destructive focus-visible:ring-destructive')}
      />
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {problemKey && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {t(problemKey, { count: PASSWORD_MIN_LENGTH })}
        </p>
      )}
    </div>
  );
}

/**
 * A chave sai escrita, nunca montada com o modo dentro de crase: chave montada
 * nao e' vista por `i18n-keys.test.js`, e a que faltar aparece crua na tela.
 */
const MODE_TABS = Object.freeze([
  {
    mode: SIGN_IN_MODES.SIGN_IN,
    labelKey: 'signIn.modes.signIn',
    submitKey: 'signIn.submit.signIn',
  },
  {
    mode: SIGN_IN_MODES.REGISTER,
    labelKey: 'signIn.modes.register',
    submitKey: 'signIn.submit.register',
  },
]);

export default function SignIn() {
  const { t } = useTranslation();
  const { authError } = useAuth();
  const {
    googleButtonRef,
    signInWithApple,
    isGoogleEnabled,
    isAppleEnabled,
    isSubmitting,
    error,
    mode,
    form,
    problems,
    isRegistering,
    handleFieldChange,
    handleModeChange,
    handleSubmit,
  } = useSignIn();

  const hasFederatedProvider = isGoogleEnabled || isAppleEnabled;
  const SubmitIcon = isRegistering ? UserPlus : LogIn;
  const activeTab = MODE_TABS.find((tab) => tab.mode === mode);

  return (
    <AuthLayout
      title={t('signIn.title')}
      subtitle={t('signIn.subtitle')}
      footer={t('signIn.footer')}
    >
      <div
        role="tablist"
        aria-label={t('signIn.title')}
        className="grid grid-cols-2 gap-1 mb-6 p-1 rounded-xl bg-muted"
      >
        {MODE_TABS.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            role="tab"
            aria-selected={mode === tab.mode}
            onClick={() => handleModeChange(tab.mode)}
            className={cn(
              'min-h-11 rounded-lg text-sm font-medium transition-colors',
              mode === tab.mode
                ? 'bg-gradient-to-r from-blue-500 to-amber-500 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {isRegistering && (
          <Field
            id="sign-in-full-name"
            name="fullName"
            type="text"
            label={t('signIn.fields.fullName')}
            value={form.fullName}
            autoComplete="name"
            onChange={handleFieldChange}
          />
        )}

        <Field
          id="sign-in-email"
          name="email"
          type="email"
          label={t('signIn.fields.email')}
          value={form.email}
          problemKey={problems.email}
          autoComplete="email"
          onChange={handleFieldChange}
        />

        <Field
          id="sign-in-password"
          name="password"
          type="password"
          label={t('signIn.fields.password')}
          value={form.password}
          problemKey={problems.password}
          hint={isRegistering ? t('signIn.passwordHint', { count: PASSWORD_MIN_LENGTH }) : undefined}
          autoComplete={isRegistering ? 'new-password' : 'current-password'}
          onChange={handleFieldChange}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full gap-2 min-h-11">
          <SubmitIcon aria-hidden="true" className="w-4 h-4" />
          {isSubmitting ? t('signIn.submitting') : t(activeTab.submitKey)}
        </Button>

        {error && (
          <p role="alert" className="text-sm text-destructive text-center">
            {t(error)}
          </p>
        )}

        {authError && (
          <p role="alert" className="text-sm text-destructive text-center">
            {t('signIn.errors.server')}
          </p>
        )}
      </form>

      {hasFederatedProvider ? (
        <div className="mt-6 flex flex-col items-center gap-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t('signIn.dividerOtherWays')}
          </p>

          {isGoogleEnabled && <div ref={googleButtonRef} className="min-h-11" />}

          {isAppleEnabled && (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 min-h-11 rounded-full"
              onClick={signInWithApple}
              disabled={isSubmitting}
            >
              <AppleMark />
              {t('signIn.apple')}
            </Button>
          )}
        </div>
      ) : (
        /**
         * A ausencia do Google e' informacao, nao defeito: enquanto `D7` nao
         * chega, e-mail e senha e' a porta. Sumir calado faria parecer que a
         * tela carregou pela metade.
         */
        <p className="mt-6 text-xs text-muted-foreground text-center">{t('signIn.noProvider')}</p>
      )}

      {/* Paginas em HTML puro, fora da SPA: o `<a>` recarrega de proposito. */}
      <nav className="mt-6 flex justify-center gap-4 text-xs text-muted-foreground">
        <a href="/dicas" className="underline underline-offset-2 hover:text-foreground">
          {t('signIn.links.tips')}
        </a>
        <a href="/sobre" className="underline underline-offset-2 hover:text-foreground">
          {t('signIn.links.about')}
        </a>
        <a href="/privacidade" className="underline underline-offset-2 hover:text-foreground">
          {t('signIn.links.privacy')}
        </a>
      </nav>
    </AuthLayout>
  );
}
