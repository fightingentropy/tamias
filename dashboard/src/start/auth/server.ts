import { getApiUrl } from "@tamias/utils/envs";
import { redirect } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { serialize } from "cookie-es";
import { jwtDecode } from "jwt-decode";
import { getInternalApiFetch } from "@/start/server/cloudflare-context";
import {
  type AuthCookieState,
  getAuthCookieNames,
  getRequestHost,
  isLocalHost,
  readAuthCookiesFromRequest,
} from "./cookies";

type AuthTokens = {
  token: string;
  refreshToken: string;
};

export type RequestAuthContext = AuthCookieState & {
  cookieHeaders: string[];
};

type AuthActionResult =
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

function authActionErrorResponseBody(error: unknown) {
  if (process.env.NODE_ENV === "production") {
    return {
      error: error instanceof Error ? error.message : "Auth error",
    };
  }

  if (error instanceof Error) {
    const withData = error as Error & { data?: unknown };
    return {
      error: error.message,
      ...(withData.data !== undefined ? { details: withData.data } : {}),
      ...(error.cause !== undefined ? { cause: String(error.cause) } : {}),
    };
  }

  return { error: String(error) };
}

async function fetchAuthAction(
  request: Request,
  action: "auth:signIn" | "auth:signOut",
  args?: Record<string, unknown>,
  opts?: { token?: string },
): Promise<AuthActionResult> {
  const internalApiFetch = getInternalApiFetch();
  const url = new URL("/auth", internalApiFetch ? request.url : getApiUrl()).toString();
  const headers = new Headers({
    "content-type": "application/json",
  });

  if (opts?.token) {
    headers.set("authorization", `Bearer ${opts.token}`);
  }

  const requestInit: RequestInit = {
    method: "POST",
    headers,
    body: JSON.stringify({ action, args: args ?? {} }),
  };
  const response = internalApiFetch
    ? await internalApiFetch(new Request(url, requestInit))
    : await fetch(url, requestInit);
  const body = (await response.json().catch(() => null)) as
    | ({ error?: string } & AuthActionResult)
    | null;

  if (!response.ok) {
    throw new Error(body?.error ?? `Auth request failed with HTTP ${response.status}`);
  }

  return (body ?? {}) as AuthActionResult;
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

function buildAuthCookieHeaders(host: string, auth: AuthTokens | null, verifier?: string | null) {
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
    headers.push(serialize(names.refreshToken, auth.refreshToken, cookieOptions));
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

const getCurrentStartAuthContext = createIsomorphicFn()
  .client(() => undefined as RequestAuthContext | undefined)
  .server(async () => {
    const { getStartContext } = await import("@tanstack/start-storage-context");
    const startContext = getStartContext({ throwIfNotFound: false });

    return startContext?.contextAfterGlobalMiddlewares?.auth as RequestAuthContext | undefined;
  });

const getCurrentStartRequest = createIsomorphicFn()
  .client(() => undefined as Request | undefined)
  .server(async () => {
    const { getStartContext } = await import("@tanstack/start-storage-context");
    const startContext = getStartContext({ throwIfNotFound: false });

    return startContext?.request as Request | undefined;
  });

export async function getAuthToken() {
  const authContext = await getCurrentStartAuthContext();

  if (authContext) {
    return authContext.token ?? undefined;
  }

  const request = await getCurrentStartRequest();
  if (!request) {
    return undefined;
  }

  return readAuthCookiesFromRequest(request).token ?? undefined;
}

export async function isAuthenticated() {
  return Boolean(await getAuthToken());
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
    const result = await fetchAuthAction(
      request,
      "auth:signIn",
      {
        refreshToken: authState.refreshToken,
      },
      authState.token ? { token: authState.token } : undefined,
    );

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
      cookieHeaders: buildAuthCookieHeaders(getRequestHost(request), result.tokens, null),
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
  const bodyRaw: unknown = await request.json();
  if (bodyRaw === null || typeof bodyRaw !== "object") {
    return new Response("Invalid body", { status: 400 });
  }
  const body = bodyRaw as { action?: unknown; args?: unknown };
  const action = body.action;
  const args: Record<string, unknown> =
    body.args !== undefined && body.args !== null && typeof body.args === "object"
      ? { ...(body.args as Record<string, unknown>) }
      : {};

  if (action !== "auth:signIn" && action !== "auth:signOut") {
    return new Response("Invalid action", { status: 400 });
  }

  if (action === "auth:signIn" && args.refreshToken !== undefined) {
    args.refreshToken = authState.refreshToken;
  }

  const oauthParams = args.params;
  const oauthCode =
    oauthParams !== undefined &&
    oauthParams !== null &&
    typeof oauthParams === "object" &&
    "code" in oauthParams &&
    typeof (oauthParams as { code: unknown }).code === "string"
      ? (oauthParams as { code: string }).code
      : undefined;

  const token =
    action === "auth:signIn" && (args.refreshToken || oauthCode)
      ? undefined
      : (authState.token ?? undefined);

  try {
    if (action === "auth:signIn") {
      const result = await fetchAuthAction(
        request,
        "auth:signIn",
        args,
        token ? { token } : undefined,
      );

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

        return appendCookieHeaders(response, buildAuthCookieHeaders(host, result.tokens, null));
      }

      return jsonResponse(result);
    }

    await fetchAuthAction(request, "auth:signOut", args, token ? { token } : undefined);
  } catch (error) {
    if (action === "auth:signIn") {
      if (process.env.NODE_ENV !== "production") {
        console.error("[auth] auth:signIn failed:", error);
      }

      const response = jsonResponse(authActionErrorResponseBody(error), 400);
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
