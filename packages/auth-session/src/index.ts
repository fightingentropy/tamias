import { SignJWT, type JWTPayload, jwtVerify } from "jose";
import { expandScopes } from "./scopes";
import { safeCompare } from "./safe-compare";

type UserId = string;
type TeamId = string;

export type Session = {
  user: {
    id: UserId;
    email?: string;
    full_name?: string;
  };
  teamId?: string;
  teamMembershipIds?: string[];
};

export type AuthIdentity = {
  subject?: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  session_id?: string;
};

type AuthJWTPayload = JWTPayload & {
  email?: string;
  name?: string;
  picture?: string;
  sid?: string;
};

export type SessionUserRecord = {
  id: UserId;
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  teamId?: string | null;
};

export type SessionResolverDependencies = {
  ensureCurrentUser(
    accessToken?: string,
    identity?: AuthIdentity | null,
  ): Promise<SessionUserRecord | null>;
  getTeamMembershipIds(args: { userId?: UserId; email?: string | null }): Promise<string[]>;
  getCurrentUser(args: {
    userId?: UserId;
    email?: string | null;
  }): Promise<SessionUserRecord | null>;
};

type OAuthApplicationRecord = {
  clientId?: string | null;
  name?: string | null;
};

type OAuthTokenUserRecord = {
  id: UserId;
  email?: string | null;
  fullName?: string | null;
};

export type OAuthAccessTokenRecord = {
  id: string;
  teamId: string;
  scopes?: string[] | null;
  applicationId: string;
  application?: OAuthApplicationRecord | null;
  user?: OAuthTokenUserRecord | null;
};

export type ApiKeyRecord = {
  id: string;
  teamId: string;
  scopes?: string[] | null;
  user?: OAuthTokenUserRecord | null;
};

export type ResolveRequestAuthDependencies = {
  internalApiKey?: string;
  resolveUserSession(accessToken?: string): Promise<Session | null>;
  getOAuthAccessTokenByToken(token: string): Promise<OAuthAccessTokenRecord | null>;
  getApiKeyByToken(token: string): Promise<ApiKeyRecord | null>;
  touchOAuthAccessToken?(id: string): Promise<void>;
  touchApiKey?(id: string): Promise<void>;
};

export type RequestAuthResult = {
  session: Session | null;
  teamId?: string;
  scopes: string[];
  isInternalRequest: boolean;
};

export const DASHBOARD_AUTH_HEADER = "x-dashboard-key";
export const TRUSTED_SESSION_HEADER = "x-trusted-session";

const DEFAULT_ACCESS_TOKEN_ISSUER = "tamias-auth";

function getAccessTokenIssuer() {
  return (process.env.TAMIAS_AUTH_ISSUER || DEFAULT_ACCESS_TOKEN_ISSUER).replace(/\/$/, "");
}

function getAccessTokenSecret() {
  const secret =
    process.env.TAMIAS_AUTH_SECRET ||
    process.env.INTERNAL_API_KEY ||
    process.env.FILE_KEY_SECRET ||
    process.env.INVOICE_JWT_SECRET;

  if (!secret) {
    throw new Error("TAMIAS_AUTH_SECRET or INTERNAL_API_KEY is required for auth tokens");
  }

  return new TextEncoder().encode(secret);
}

function getHeader(headers: Headers | Record<string, string | undefined>, name: string) {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const normalizedName = name.toLowerCase();

  for (const [headerName, value] of Object.entries(headers)) {
    if (headerName.toLowerCase() === normalizedName) {
      return value;
    }
  }

  return undefined;
}

function toSessionUserRecord(record: SessionUserRecord, identity: AuthIdentity | null) {
  const userId = record.id;

  return {
    id: userId,
    email: record.email ?? identity?.email ?? undefined,
    full_name: record.fullName ?? identity?.full_name,
  };
}

export async function createAccessToken(
  user: {
    id: string;
    email?: string | null;
    fullName?: string | null;
    avatarUrl?: string | null;
  },
  options: {
    sessionId: string;
    expiresIn?: string | number;
  },
) {
  return new SignJWT({
    email: user.email ?? undefined,
    name: user.fullName ?? undefined,
    picture: user.avatarUrl ?? undefined,
    sid: options.sessionId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(getAccessTokenIssuer())
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? "15m")
    .sign(getAccessTokenSecret());
}

export async function verifyAccessToken(
  accessToken?: string,
  issuer = getAccessTokenIssuer(),
): Promise<AuthIdentity | null> {
  if (!accessToken || !issuer) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(accessToken, getAccessTokenSecret(), { issuer });
    const authPayload = payload as AuthJWTPayload;

    return {
      subject: authPayload.sub,
      email: authPayload.email,
      full_name: authPayload.name,
      avatar_url: authPayload.picture,
      session_id: authPayload.sid,
    };
  } catch {
    return null;
  }
}

export async function resolveSession(
  dependencies: SessionResolverDependencies,
  identity: AuthIdentity | null,
  accessToken?: string,
): Promise<Session | null> {
  const ensuredUser = await dependencies.ensureCurrentUser(accessToken, identity);

  if (ensuredUser?.id) {
    const teamMembershipIds = await dependencies.getTeamMembershipIds({
      userId: ensuredUser.id,
      email: ensuredUser.email ?? identity?.email ?? null,
    });

    return {
      teamId: ensuredUser.teamId ?? undefined,
      teamMembershipIds,
      user: toSessionUserRecord(ensuredUser, identity),
    };
  }

  if (!identity?.email) {
    return null;
  }

  const user = await dependencies.getCurrentUser({
    email: identity.email,
  });

  if (!user?.id) {
    return null;
  }

  const teamMembershipIds = await dependencies.getTeamMembershipIds({
    userId: user.id,
    email: user.email ?? identity.email,
  });

  return {
    teamId: user.teamId ?? undefined,
    teamMembershipIds,
    user: toSessionUserRecord(user, identity),
  };
}

export function createUserSessionResolver(dependencies: SessionResolverDependencies) {
  return async (accessToken?: string): Promise<Session | null> => {
    const identity = await verifyAccessToken(accessToken);
    return resolveSession(dependencies, identity, accessToken);
  };
}

export type TrustedSessionSnapshot = {
  session: Session | null;
  headerValue: string | null;
};

export function serializeTrustedSessionHeaderValue(session: Session | null): string | null {
  if (!session) {
    return null;
  }

  return encodeURIComponent(JSON.stringify(session));
}

export async function createTrustedSessionSnapshot(
  accessToken: string | null | undefined,
  resolveUserSession: (accessToken?: string) => Promise<Session | null>,
): Promise<TrustedSessionSnapshot> {
  const session = await resolveUserSession(accessToken ?? undefined);

  return {
    session,
    headerValue: serializeTrustedSessionHeaderValue(session),
  };
}

export async function createTrustedSessionHeaderValue(
  accessToken: string | null | undefined,
  resolveUserSession: (accessToken?: string) => Promise<Session | null>,
) {
  const snapshot = await createTrustedSessionSnapshot(accessToken, resolveUserSession);

  return snapshot.headerValue;
}

export function parseTrustedSessionHeaderValue(value?: string): Session | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(value)) as Session;
  } catch {
    return null;
  }
}

export async function resolveRequestAuth(
  headers: Headers | Record<string, string | undefined>,
  dependencies: ResolveRequestAuthDependencies,
): Promise<RequestAuthResult> {
  const authorization = getHeader(headers, "authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;
  const internalKey = getHeader(headers, "x-internal-key");
  const dashboardKey = getHeader(headers, DASHBOARD_AUTH_HEADER);

  const isInternalRequest =
    !!internalKey &&
    !!dependencies.internalApiKey &&
    safeCompare(internalKey, dependencies.internalApiKey);

  const hasTrustedDashboardKey =
    !!dashboardKey &&
    !!dependencies.internalApiKey &&
    safeCompare(dashboardKey, dependencies.internalApiKey);

  const trustedSession = hasTrustedDashboardKey
    ? parseTrustedSessionHeaderValue(getHeader(headers, TRUSTED_SESSION_HEADER))
    : null;

  if (trustedSession) {
    return {
      session: trustedSession,
      teamId: trustedSession.teamId,
      scopes: expandScopes(["apis.all"]),
      isInternalRequest,
    };
  }

  const session = await dependencies.resolveUserSession(bearerToken);

  if (session) {
    return {
      session,
      teamId: session.teamId,
      scopes: expandScopes(["apis.all"]),
      isInternalRequest,
    };
  }

  if (!bearerToken) {
    return {
      session: null,
      teamId: undefined,
      scopes: [],
      isInternalRequest,
    };
  }

  if (bearerToken.startsWith("mid_access_token_")) {
    const tokenData = await dependencies.getOAuthAccessTokenByToken(bearerToken);

    if (!tokenData?.user?.id) {
      return {
        session: null,
        teamId: undefined,
        scopes: [],
        isInternalRequest,
      };
    }

    await dependencies.touchOAuthAccessToken?.(tokenData.id);

    return {
      session: {
        teamId: tokenData.teamId,
        user: {
          id: tokenData.user.id,
          email: tokenData.user.email ?? undefined,
          full_name: tokenData.user.fullName ?? undefined,
        },
      },
      teamId: tokenData.teamId,
      scopes: expandScopes(tokenData.scopes ?? []),
      isInternalRequest,
    };
  }

  if (!bearerToken.startsWith("mid_")) {
    return {
      session: null,
      teamId: undefined,
      scopes: [],
      isInternalRequest,
    };
  }

  const apiKey = await dependencies.getApiKeyByToken(bearerToken);

  if (!apiKey?.user?.id) {
    return {
      session: null,
      teamId: undefined,
      scopes: [],
      isInternalRequest,
    };
  }

  await dependencies.touchApiKey?.(apiKey.id);

  return {
    session: {
      teamId: apiKey.teamId,
      user: {
        id: apiKey.user.id,
        email: apiKey.user.email ?? undefined,
        full_name: apiKey.user.fullName ?? undefined,
      },
    },
    teamId: apiKey.teamId,
    scopes: expandScopes(apiKey.scopes ?? []),
    isInternalRequest,
  };
}

export { expandScopes };
export type { Scope, ScopePreset } from "./scopes";
export { SCOPES, scopePresets, scopesToName } from "./scopes";
