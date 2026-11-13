/**
 * Pai Presente — frontend
 * Copyright (c) 2026. Todos os direitos reservados.
 * Licenca: proprietaria.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { loadScript } from './load-script';
import { findLocale, getLocale } from './locale';
import { describeCredentialProblems, initialSignInMode, SIGN_IN_MODES, toCredentials } from './sign-in-form';

/** Identificador de cliente e publico por definicao — nao e segredo. */
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const APPLE_CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID ?? '';

const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';
/**
 * A Apple serve um script por idioma, e o botao dela fala a lingua da pasta.
 * O idioma e' lido na hora do clique: e' quando a janela dela abre.
 */
function appleScriptFor(locale) {
  return `https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/${findLocale(locale).appleScriptLocale}/appleid.auth.js`;
}

/** O idioma do botao do Google entra na hora de desenha-lo (`getLocale()`). */
const GOOGLE_BUTTON = Object.freeze({
  type: 'standard',
  theme: 'outline',
  size: 'large',
  shape: 'pill',
  text: 'continue_with',
  width: 320,
});

/** A entrada por e-mail e senha nao depende de terceiro nenhum: sempre ha porta. */
const PASSWORD_PROVIDER = 'password';

/**
 * A tela mostra CHAVE de traducao, nunca frase montada aqui (`web.md` §6). O
 * erro do servidor tambem vira chave: a mensagem dele cita motivo tecnico, e
 * detalhe de token nao ajuda quem esta tentando entrar.
 */
const FAILURE_KEYS = Object.freeze({
  signInKey: 'signIn.errors.failed',
  registerKey: 'signIn.errors.registerFailed',
  emailTakenKey: 'signIn.errors.emailTaken',
  blockedKey: 'signIn.errors.blocked',
});

/** Conta bloqueada pela equipe: a API so diz isso depois da senha certa. */
const USER_BLOCKED = 'AUTH_USER_BLOCKED';

const EMAIL_ALREADY_REGISTERED = 'AUTH_EMAIL_ALREADY_REGISTERED';

const EMPTY_FORM = Object.freeze({ email: '', password: '', fullName: '' });

export function useSignIn() {
  const { signIn, register } = useAuth();
  const googleButtonRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(() =>
    initialSignInMode(typeof window === 'undefined' ? '' : window.location.search),
  );
  const [form, setForm] = useState(EMPTY_FORM);
  const [problems, setProblems] = useState(Object.freeze({}));

  /**
   * A mensagem da API pode citar o motivo tecnico da recusa; a tela mostra uma
   * frase so, porque detalhe de token nao ajuda quem esta tentando entrar.
   */
  const submitToken = useCallback(
    async ({ provider, idToken }) => {
      setIsSubmitting(true);
      setError(null);
      try {
        await signIn({ provider, idToken });
      } catch (failure) {
        setError(failure?.code === USER_BLOCKED ? FAILURE_KEYS.blockedKey : FAILURE_KEYS.signInKey);
      } finally {
        setIsSubmitting(false);
      }
    },
    [signIn],
  );

  /** O Google guarda a funcao no `initialize` e nunca mais a rele. */
  const submitTokenRef = useRef(submitToken);
  submitTokenRef.current = submitToken;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let isMounted = true;

    loadScript(GOOGLE_SCRIPT)
      .then(() => {
        if (!isMounted || !googleButtonRef.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: ({ credential }) =>
            submitTokenRef.current({ provider: 'google', idToken: credential }),
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, { ...GOOGLE_BUTTON, locale: getLocale() });
      })
      .catch(() => {
        if (isMounted) setError(FAILURE_KEYS.signInKey);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const signInWithApple = useCallback(async () => {
    try {
      await loadScript(appleScriptFor(getLocale()));
      window.AppleID.auth.init({
        clientId: APPLE_CLIENT_ID,
        scope: 'name email',
        redirectURI: window.location.origin,
        usePopup: true,
      });
      const response = await window.AppleID.auth.signIn();
      await submitToken({ provider: 'apple', idToken: response.authorization.id_token });
    } catch {
      /** Fechar a janelinha da Apple tambem cai aqui, e nao e erro de ninguem. */
      setError(FAILURE_KEYS.signInKey);
    }
  }, [submitToken]);

  /** Editar o campo apaga o erro DELE: o aviso velho acusa o que ja foi corrigido. */
  const handleFieldChange = useCallback(({ target: { name, value } }) => {
    setForm((current) => ({ ...current, [name]: value }));
    setProblems((current) => {
      if (!Object.hasOwn(current, name)) return current;
      const { [name]: _removed, ...rest } = current;
      return Object.freeze(rest);
    });
  }, []);

  const handleModeChange = useCallback((nextMode) => {
    setMode(nextMode);
    setError(null);
    /**
     * Os problemas eram do outro modo: entrando, senha de 4 letras e' so senha
     * errada; cadastrando, e' curta. Manter o aviso apontaria o campo errado.
     */
    setProblems(Object.freeze({}));
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      const found = describeCredentialProblems({ ...form, mode });
      setProblems(found);
      if (Object.keys(found).length > 0) return;

      const { email, password, fullName } = toCredentials(form);
      const isRegistering = mode === SIGN_IN_MODES.REGISTER;
      setIsSubmitting(true);
      setError(null);
      try {
        if (isRegistering) await register({ email, password, fullName });
        else await signIn({ provider: PASSWORD_PROVIDER, email, password });
      } catch (failure) {
        /**
         * O 409 e' o UNICO caso em que dizer o motivo ajuda: e a conta do
         * proprio dono, e a saida dele e' entrar em vez de criar outra. Na
         * ENTRADA a recusa continua vaga de proposito — a API responde a mesma
         * coisa para senha errada e e-mail que nao existe, e detalhar aqui
         * desfaria isso do lado do cliente.
         */
        if (failure?.code === USER_BLOCKED) setError(FAILURE_KEYS.blockedKey);
        else if (isRegistering && failure?.code === EMAIL_ALREADY_REGISTERED) {
          setProblems(Object.freeze({ email: FAILURE_KEYS.emailTakenKey }));
        } else setError(isRegistering ? FAILURE_KEYS.registerKey : FAILURE_KEYS.signInKey);
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, mode, register, signIn],
  );

  return {
    googleButtonRef,
    signInWithApple,
    isGoogleEnabled: GOOGLE_CLIENT_ID !== '',
    isAppleEnabled: APPLE_CLIENT_ID !== '',
    isSubmitting,
    error,
    mode,
    form,
    problems,
    isRegistering: mode === SIGN_IN_MODES.REGISTER,
    handleFieldChange,
    handleModeChange,
    handleSubmit,
  };
}
