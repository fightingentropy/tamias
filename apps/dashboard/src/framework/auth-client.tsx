"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RootBootstrapData } from "@/start/root-bootstrap";

type AuthState = {
  token: string | null;
  hasRefreshToken: boolean;
};

type AuthActionResponse =
  | {
      redirect: string;
      verifier?: string;
      tokens?: undefined;
    }
  | {
      redirect?: undefined;
      verifier?: undefined;
      tokens: { token: string; refreshToken?: string } | null;
    }
  | {
      redirect?: undefined;
      verifier?: undefined;
      tokens?: undefined;
    };

type SignInParams = Record<string, unknown> | FormData | undefined;

type AuthActions = {
  signIn: (
    provider?: string,
    args?: SignInParams,
  ) => Promise<{ signingIn: boolean; redirect?: URL }>;
  signOut: () => Promise<void>;
};

type AuthStatus = {
  isAuthenticated: boolean;
  isLoading: boolean;
  fetchAccessToken: (opts?: { forceRefreshToken?: boolean }) => Promise<string | null>;
};

const AuthActionsContext = createContext<AuthActions | null>(null);
const AuthStatusContext = createContext<AuthStatus | null>(null);
const AuthTokenContext = createContext<string | null>(null);

const OAUTH_VERIFIER_STORAGE_KEY = "tamias.auth.verifier";
const TOKEN_REFRESH_BUFFER_MS = 60_000;

function getInitialAuthState(bootstrap: RootBootstrapData): AuthState {
  return {
    token: bootstrap.auth.token,
    hasRefreshToken: Boolean(bootstrap.auth.refreshToken),
  };
}

function decodeJwtExpiry(token: string) {
  try {
    const [, encodedPayload] = token.split(".");

    if (!encodedPayload) {
      return null;
    }

    const payload = JSON.parse(
      atob(encodedPayload.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number };

    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function normalizeSignInParams(args: SignInParams) {
  if (!args) {
    return {};
  }

  if (args instanceof FormData) {
    return Array.from(args.entries()).reduce<Record<string, FormDataEntryValue>>(
      (acc, [key, value]) => {
        acc[key] = value;
        return acc;
      },
      {},
    );
  }

  return args;
}

async function callAuthAction(
  action: "auth:signIn" | "auth:signOut",
  args?: Record<string, unknown>,
) {
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ action, args }),
  });

  const body = (await response.json().catch(() => null)) as
    | ({ error?: string } & AuthActionResponse)
    | null;

  if (response.status >= 400) {
    throw new Error(body?.error ?? "Authentication failed");
  }

  return (body ?? {}) as AuthActionResponse;
}

export function AuthProvider(props: {
  children: ReactNode;
  bootstrap: RootBootstrapData;
}) {
  const [authState, setAuthState] = useState<AuthState>(() =>
    getInitialAuthState(props.bootstrap),
  );
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    setAuthState(getInitialAuthState(props.bootstrap));
  }, [
    props.bootstrap.auth.refreshToken,
    props.bootstrap.auth.token,
    props.bootstrap.fetchedAt,
  ]);

  const clearAuthState = useCallback(() => {
    setAuthState({
      token: null,
      hasRefreshToken: false,
    });
  }, []);

  const refreshAccessToken = useCallback(async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    if (!authState.hasRefreshToken) {
      clearAuthState();
      return null;
    }

    const refreshPromise = (async () => {
      try {
        const result = await callAuthAction("auth:signIn", {
          refreshToken: true,
        });

        if (!("tokens" in result) || result.tokens === undefined) {
          clearAuthState();
          return null;
        }

        if (result.tokens === null) {
          clearAuthState();
          return null;
        }

        setAuthState({
          token: result.tokens.token,
          hasRefreshToken: true,
        });

        return result.tokens.token;
      } catch {
        clearAuthState();
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, [authState.hasRefreshToken, clearAuthState]);

  useEffect(() => {
    if (!authState.token || !authState.hasRefreshToken) {
      return;
    }

    const expiry = decodeJwtExpiry(authState.token);

    if (expiry === null) {
      return;
    }

    const delay = expiry - Date.now() - TOKEN_REFRESH_BUFFER_MS;

    if (delay <= 0) {
      void refreshAccessToken();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshAccessToken();
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [authState.hasRefreshToken, authState.token, refreshAccessToken]);

  useEffect(() => {
    if (!authState.token || !authState.hasRefreshToken) {
      return;
    }

    const token = authState.token;

    const refreshIfNeeded = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      const expiry = decodeJwtExpiry(token);

      if (expiry === null || expiry - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
        return;
      }

      void refreshAccessToken();
    };

    document.addEventListener("visibilitychange", refreshIfNeeded);
    return () =>
      document.removeEventListener("visibilitychange", refreshIfNeeded);
  }, [authState.hasRefreshToken, authState.token, refreshAccessToken]);

  const signIn = useCallback<AuthActions["signIn"]>(
    async (provider, args) => {
      const verifier =
        typeof window === "undefined"
          ? undefined
          : window.sessionStorage.getItem(OAUTH_VERIFIER_STORAGE_KEY) ??
            undefined;

      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(OAUTH_VERIFIER_STORAGE_KEY);
      }

      const result = await callAuthAction("auth:signIn", {
        provider,
        params: normalizeSignInParams(args),
        verifier,
      });

      if ("redirect" in result && result.redirect) {
        const redirect = new URL(result.redirect, window.location.origin);

        if (result.verifier) {
          window.sessionStorage.setItem(
            OAUTH_VERIFIER_STORAGE_KEY,
            result.verifier,
          );
        }

        window.location.href = redirect.toString();
        return {
          signingIn: false,
          redirect,
        };
      }

      if ("tokens" in result && result.tokens !== undefined) {
        if (result.tokens === null) {
          clearAuthState();
          return { signingIn: false };
        }

        setAuthState({
          token: result.tokens.token,
          hasRefreshToken: true,
        });

        return {
          signingIn: true,
        };
      }

      return {
        signingIn: false,
      };
    },
    [clearAuthState],
  );

  const signOut = useCallback(async () => {
    try {
      await callAuthAction("auth:signOut");
    } finally {
      clearAuthState();
    }
  }, [clearAuthState]);

  const actions = useMemo<AuthActions>(
    () => ({
      signIn,
      signOut,
    }),
    [signIn, signOut],
  );

  const status = useMemo<AuthStatus>(
    () => ({
      isAuthenticated: authState.token !== null,
      isLoading: false,
      fetchAccessToken: async (opts) =>
        opts?.forceRefreshToken ? refreshAccessToken() : authState.token,
    }),
    [authState.token, refreshAccessToken],
  );

  return (
    <AuthStatusContext.Provider value={status}>
      <AuthActionsContext.Provider value={actions}>
        <AuthTokenContext.Provider value={authState.token}>
          {props.children}
        </AuthTokenContext.Provider>
      </AuthActionsContext.Provider>
    </AuthStatusContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthStatusContext);

  if (!value) {
    throw new Error("useAuth() must be used inside of an AuthProvider");
  }

  return value;
}

export function useAuthActions() {
  const value = useContext(AuthActionsContext);

  if (!value) {
    throw new Error("useAuthActions() must be used inside of an AuthProvider");
  }

  return value;
}

export function useAuthToken() {
  return useContext(AuthTokenContext);
}
