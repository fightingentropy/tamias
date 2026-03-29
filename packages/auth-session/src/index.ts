import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";
import type { Id } from "@tamias/convex-model/data-model";
import { expandScopes } from "./scopes";
import { safeCompare } from "./safe-compare";

type ConvexUserId = Id<"appUsers">;
type ConvexTeamId = Id<"teams">;

export type Session = {
  user: {
    id: ConvexUserId;
    convexId?: ConvexUserId;
    email?: string;
    full_name?: string;
  };
  teamId?: string;
  convexTeamId?: ConvexTeamId;
  teamMembershipIds?: string[];
  convexTeamMembershipIds?: ConvexTeamId[];
};

export type AuthIdentity = {
  email?: string;
  full_name?: string;
};

type ConvexJWTPayload = JWTPayload & {
  email?: string;
  name?: string;
};

export type SessionUserRecord = {
  convexId: ConvexUserId;
  email?: string | null;
  fullName?: string | null;
  teamId?: string | null;
  convexTeamId?: ConvexTeamId | null;
};

export type SessionResolverDependencies = {
  getSessionFromConvex(accessToken?: string): Promise<Session | null>;
  ensureCurrentAppUser(accessToken?: string): Promise<SessionUserRecord | null>;
  getTeamMembershipIds(args: {
    userId?: ConvexUserId;
    email?: string | null;
  }): Promise<string[]>;
  getCurrentUser(args: {
    userId?: ConvexUserId;
    email?: string | null;
  }): Promise<SessionUserRecord | null>;
};

type OAuthApplicationRecord = {
  clientId?: string | null;
  name?: string | null;
};

type OAuthTokenUserRecord = {
  id: ConvexUserId;
  convexId?: ConvexUserId | null;
  email?: string | null;
  fullName?: string | null;
};

export type OAuthAccessTokenRecord = {
  id: string;
  teamId: string;
  convexTeamId?: ConvexTeamId | null;
  scopes?: string[] | null;
  applicationId: string;
  application?: OAuthApplicationRecord | null;
  user?: OAuthTokenUserRecord | null;
};

export type ApiKeyRecord = {
  id: string;
  teamId: string;
  convexTeamId?: ConvexTeamId | null;
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

const convexJwksByIssuer = new Map<
  string,
  ReturnType<typeof createRemoteJWKSet>
>();

function getDefaultAccessTokenIssuer() {
  return (
    process.env.CONVEX_SITE_URL ||
    process.env.NEXT_PUBLIC_CONVEX_SITE_URL ||
    process.env.NEXT_PUBLIC_CONVEX_URL
  )?.replace(/\/$/, "");
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
  return {
    id: record.convexId,
    convexId: record.convexId,
    email: record.email ?? identity?.email ?? undefined,
    full_name: record.fullName ?? identity?.full_name,
  };
}

export async function verifyAccessToken(
  accessToken?: string,
  issuer = getDefaultAccessTokenIssuer(),
): Promise<AuthIdentity | null> {
  if (!accessToken || !issuer) {
    return null;
  }

  try {
    let jwks = convexJwksByIssuer.get(issuer);

    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
      convexJwksByIssuer.set(issuer, jwks);
    }

    const { payload } = await jwtVerify(accessToken, jwks, { issuer });
    const convexPayload = payload as ConvexJWTPayload;

    return {
      email: convexPayload.email,
      full_name: convexPayload.name,
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
  const convexSession = await dependencies.getSessionFromConvex(accessToken);

  if (convexSession?.user.id) {
    return convexSession;
  }

  const ensuredUser = await dependencies.ensureCurrentAppUser(accessToken);

  if (ensuredUser?.convexId) {
    const teamMembershipIds = await dependencies.getTeamMembershipIds({
      userId: ensuredUser.convexId,
      email: ensuredUser.email ?? identity?.email ?? null,
    });

    return {
      teamId: ensuredUser.teamId ?? undefined,
      convexTeamId: ensuredUser.convexTeamId ?? undefined,
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

  if (!user?.convexId) {
    return null;
  }

  const teamMembershipIds = await dependencies.getTeamMembershipIds({
    userId: user.convexId,
    email: user.email ?? identity.email,
  });

  return {
    teamId: user.teamId ?? undefined,
    convexTeamId: user.convexTeamId ?? undefined,
    teamMembershipIds,
    user: toSessionUserRecord(user, identity),
  };
}

export function createUserSessionResolver(
  dependencies: SessionResolverDependencies,
) {
  return async (accessToken?: string): Promise<Session | null> => {
    const identity = await verifyAccessToken(accessToken);
    return resolveSession(dependencies, identity, accessToken);
  };
}

export type TrustedSessionSnapshot = {
  session: Session | null;
  headerValue: string | null;
};

export function serializeTrustedSessionHeaderValue(
  session: Session | null,
): string | null {
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
  const snapshot = await createTrustedSessionSnapshot(
    accessToken,
    resolveUserSession,
  );

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
    const tokenData =
      await dependencies.getOAuthAccessTokenByToken(bearerToken);

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
        convexTeamId: tokenData.convexTeamId ?? undefined,
        user: {
          id: tokenData.user.id,
          convexId: tokenData.user.convexId ?? undefined,
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
      convexTeamId: apiKey.convexTeamId ?? undefined,
      user: {
        id: apiKey.user.id,
        convexId: apiKey.user.convexId ?? undefined,
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
