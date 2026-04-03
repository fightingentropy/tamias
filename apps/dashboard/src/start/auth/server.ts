import { getConvexUrl } from "@tamias/utils/envs";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import { jwtDecode } from "jwt-decode";
import { serialize } from "cookie-es";
import { redirect } from "@tanstack/react-router";
import { getStartContext } from "@tanstack/start-storage-context";
import {
  getAuthCookieNames,
  getRequestHost,
  isLocalHost,
  readAuthCookiesFromRequest,
  type AuthCookieState,
} from "./cookies";

type AuthTokens = {
  token: string;
  refreshToken: string;
};

export type RequestAuthContext = AuthCookieState & {
  cookieHeaders: string[];
};

type ConvexSignInResult =
  | {
      redirect: string;
      verifier?: string;
      tokens?: undefined;
    }
  | {
      redirect?: undefined;
      verifier?: undefined;
      tokens: AuthTokens | null;
    }
  | {
      redirect?: undefined;
      verifier?: undefined;
      tokens?: undefined;
    };

const REQUIRED_TOKEN_LIFETIME_MS = 60_000;
const MINIMUM_REQUIRED_TOKEN_LIFETIME_MS = 10_000;

export function createAnonymousRequestAuthContext(): RequestAuthContext {
  return {
    token: null,
    refreshToken: null,
    verifier: null,
    cookieHeaders: [],
  };
}

function createConvexHttpClient(token?: string) {
  const client = new ConvexHttpClient(getConvexUrl(), { logger: false });

  if (token) {
    client.setAuth(token);
  }

  (client as any).setFetchOptions?.({ cache: "no-store" });
  return client;
}

async function fetchConvexAction<Action extends FunctionReference<"action">>(
  action: Action,
  args?: Record<string, unknown>,
  opts?: { token?: string },
): Promise<FunctionReturnType<Action>> {
  return (createConvexHttpClient(opts?.token) as any).action(action, args ?? {});
}

function decodeToken(token: string) {
  try {
    return jwtDecode<{ exp?: number; iat?: number }>(token);
  } catch {
    return null;
  }
}

function shouldRefreshToken(token: string) {
  const decodedToken = decodeToken(token);

  if (!decodedToken?.exp || !decodedToken.iat) {
    return true;
  }

  const totalTokenLifetimeMs = decodedToken.exp * 1000 - decodedToken.iat * 1000;
  const minimumExpiration =
    Date.now() +
    Math.min(
      REQUIRED_TOKEN_LIFETIME_MS,
      Math.max(MINIMUM_REQUIRED_TOKEN_LIFETIME_MS, totalTokenLifetimeMs / 10),
    );

  return decodedToken.exp * 1000 <= minimumExpiration;
}

function getCookieOptions(host: string) {
  const localhost = isLocalHost(host);

  return {
    secure: localhost ? false : true,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
  };
}

function buildAuthCookieHeaders(
  host: string,
  auth: AuthTokens | null,
  verifier?: string | null,
) {
  const names = getAuthCookieNames(host);
  const cookieOptions = getCookieOptions(host);

  const headers: string[] = [];

  if (auth === null) {
    headers.push(
      serialize(names.token, "", {
        ...cookieOptions,
        expires: new Date(0),
        maxAge: 0,
      }),
    );
    headers.push(
      serialize(names.refreshToken, "", {
        ...cookieOptions,
        expires: new Date(0),
        maxAge: 0,
      }),
    );
  } else if (auth) {
    headers.push(serialize(names.token, auth.token, cookieOptions));
    headers.push(
      serialize(names.refreshToken, auth.refreshToken, cookieOptions),
    );
  }

  if (verifier === undefined) {
    return headers;
  }

  if (verifier === null) {
    headers.push(
      serialize(names.verifier, "", {
        ...cookieOptions,
        expires: new Date(0),
        maxAge: 0,
      }),
    );
    return headers;
  }

  headers.push(serialize(names.verifier, verifier, cookieOptions));
  return headers;
}

export function appendCookieHeaders(response: Response, cookieHeaders: string[]) {
  for (const headerValue of cookieHeaders) {
    response.headers.append("set-cookie", headerValue);
  }

  return response;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function isCrossOriginRequest(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  const requestUrl = new URL(request.url);
  const originUrl = new URL(origin);

  return (
    originUrl.host !== (request.headers.get("host") ?? requestUrl.host) ||
    originUrl.protocol !== requestUrl.protocol
  );
}

function getCurrentStartAuthContext() {
  const startContext = getStartContext({ throwIfNotFound: false });

  return startContext?.contextAfterGlobalMiddlewares?.auth as
    | RequestAuthContext
    | undefined;
}

export async function getConvexAuthToken() {
  const authContext = getCurrentStartAuthContext();

  if (authContext) {
    return authContext.token ?? undefined;
  }

  const startContext = getStartContext({ throwIfNotFound: false });

  if (!startContext) {
    return undefined;
  }

  return readAuthCookiesFromRequest(startContext.request).token ?? undefined;
}

export async function isAuthenticated() {
  return Boolean(await getConvexAuthToken());
}

async function refreshTokensIfNeeded(
  request: Request,
  authState: AuthCookieState,
): Promise<RequestAuthContext> {
  if (!authState.token && !authState.refreshToken) {
    return {
      ...createAnonymousRequestAuthContext(),
      verifier: authState.verifier,
    };
  }

  if (!authState.token || !authState.refreshToken) {
    return {
      token: null,
      refreshToken: null,
      verifier: authState.verifier,
      cookieHeaders: buildAuthCookieHeaders(getRequestHost(request), null, null),
    };
  }

  if (!shouldRefreshToken(authState.token)) {
    return {
      ...authState,
      cookieHeaders: [],
    };
  }

  try {
    const result = (await fetchConvexAction(
      "auth:signIn" as any,
      {
        refreshToken: authState.refreshToken,
      },
      authState.token ? { token: authState.token } : undefined,
    )) as ConvexSignInResult;

    if (result.tokens === undefined) {
      throw new Error("Invalid auth refresh response");
    }

    if (result.tokens === null) {
      return {
        token: null,
        refreshToken: null,
        verifier: null,
        cookieHeaders: buildAuthCookieHeaders(getRequestHost(request), null, null),
      };
    }

    return {
      token: result.tokens.token,
      refreshToken: result.tokens.refreshToken,
      verifier: null,
      cookieHeaders: buildAuthCookieHeaders(
        getRequestHost(request),
        result.tokens,
        null,
      ),
    };
  } catch {
    return {
      token: null,
      refreshToken: null,
      verifier: null,
      cookieHeaders: buildAuthCookieHeaders(getRequestHost(request), null, null),
    };
  }
}

export async function resolveRequestAuthContext(request: Request) {
  return refreshTokensIfNeeded(request, readAuthCookiesFromRequest(request));
}

export async function proxyAuthActionRequest(request: Request) {
  if (request.method !== "POST") {
    return new Response("Invalid method", { status: 405 });
  }

  if (isCrossOriginRequest(request)) {
    return new Response("Invalid origin", { status: 403 });
  }

  const host = getRequestHost(request);
  const authState = readAuthCookiesFromRequest(request);
  const body = await request.json();
  const action = body?.action;
  const args = body?.args ?? {};

  if (action !== "auth:signIn" && action !== "auth:signOut") {
    return new Response("Invalid action", { status: 400 });
  }

  if (action === "auth:signIn" && args.refreshToken !== undefined) {
    args.refreshToken = authState.refreshToken;
  }

  const token =
    action === "auth:signIn" && (args.refreshToken || args.params?.code)
      ? undefined
      : authState.token ?? undefined;

  try {
    if (action === "auth:signIn") {
      const result = (await fetchConvexAction(
        "auth:signIn" as any,
        args,
        token ? { token } : undefined,
      )) as ConvexSignInResult;

      if (result.redirect) {
        const response = jsonResponse({ redirect: result.redirect });
        return appendCookieHeaders(
          response,
          buildAuthCookieHeaders(host, undefined as never, result.verifier ?? null),
        );
      }

      if (result.tokens !== undefined) {
        const response = jsonResponse({
          tokens:
            result.tokens === null
              ? null
              : {
                  token: result.tokens.token,
                  refreshToken: "dummy",
                },
        });

        return appendCookieHeaders(
          response,
          buildAuthCookieHeaders(host, result.tokens, null),
        );
      }

      return jsonResponse(result);
    }

    await fetchConvexAction(
      "auth:signOut" as any,
      args,
      token ? { token } : undefined,
    );
  } catch (error) {
    if (action === "auth:signIn") {
      const response = jsonResponse(
        { error: error instanceof Error ? error.message : "Auth error" },
        400,
      );
      return appendCookieHeaders(response, buildAuthCookieHeaders(host, null, null));
    }
  }

  return appendCookieHeaders(jsonResponse(null), buildAuthCookieHeaders(host, null, null));
}

export function middlewareRedirect(request: Request, route: string) {
  const url = new URL(route, request.url);
  throw redirect({
    href: url.toString(),
    throw: true,
  });
}

export function convexAuthMiddleware<
  THandler extends (
    request: Request,
    ctx: { event: unknown; convexAuth: { isAuthenticated: () => Promise<boolean> } },
  ) => Response | Promise<Response>,
>(handler?: THandler) {
  return async (request: Request) => {
    if (!handler) {
      return new Response(null, { status: 200 });
    }

    return handler(request, {
      event: undefined,
      convexAuth: {
        isAuthenticated: async () => Boolean(await getConvexAuthToken()),
      },
    });
  };
}
