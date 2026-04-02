export type AuthCookieState = {
  token: string | null;
  refreshToken: string | null;
  verifier: string | null;
};

const AUTH_COOKIE_SUFFIXES = {
  token: "__convexAuthJWT",
  refreshToken: "__convexAuthRefreshToken",
  verifier: "__convexAuthOAuthVerifier",
} as const;

export function isLocalHost(host: string) {
  const normalizedHost = host.toLowerCase();
  const hostname = normalizedHost.split(":")[0] ?? "";

  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost") ||
    hostname === "tamias.test" ||
    hostname.endsWith(".tamias.test") ||
    hostname.endsWith(".test")
  );
}

export function getAuthCookieNames(host: string) {
  const prefix = isLocalHost(host) ? "" : "__Host-";

  return {
    token: `${prefix}${AUTH_COOKIE_SUFFIXES.token}`,
    refreshToken: `${prefix}${AUTH_COOKIE_SUFFIXES.refreshToken}`,
    verifier: `${prefix}${AUTH_COOKIE_SUFFIXES.verifier}`,
  };
}

export function parseCookieHeader(header: string | null | undefined) {
  const values: Record<string, string> = {};

  if (!header) {
    return values;
  }

  for (const part of header.split(/;\s*/)) {
    if (!part) {
      continue;
    }

    const separatorIndex = part.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    values[key] = decodeURIComponent(value);
  }

  return values;
}

export function getRequestHost(request: Request) {
  const requestUrl = new URL(request.url);
  return request.headers.get("host") ?? requestUrl.host;
}

export function readAuthCookiesFromRequest(request: Request): AuthCookieState {
  const parsedCookies = parseCookieHeader(request.headers.get("cookie"));
  const names = getAuthCookieNames(getRequestHost(request));

  return {
    token: parsedCookies[names.token] ?? null,
    refreshToken: parsedCookies[names.refreshToken] ?? null,
    verifier: parsedCookies[names.verifier] ?? null,
  };
}
