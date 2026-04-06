import {
  createTrustedSessionSnapshot,
  createUserSessionResolver,
  type ResolveRequestAuthDependencies,
  type SessionResolverDependencies,
} from "@tamias/auth-session";
import {
  getApiKeyByTokenFromConvex,
  getOAuthAccessTokenByTokenFromConvex,
  touchApiKeyFromConvex,
  touchOAuthAccessTokenFromConvex,
} from "./foundation";
import {
  ensureCurrentAppUserInConvex,
  getCurrentUserFromConvex,
  getSessionFromConvex,
  getTeamMembershipIdsFromConvex,
} from "./identity";

export const sessionResolverDependencies: SessionResolverDependencies = {
  getSessionFromConvex,
  ensureCurrentAppUser: ensureCurrentAppUserInConvex,
  getTeamMembershipIds: getTeamMembershipIdsFromConvex,
  getCurrentUser: getCurrentUserFromConvex,
};

export const resolveTamiasUserSession = createUserSessionResolver(sessionResolverDependencies);

export async function createTamiasTrustedSessionSnapshot(accessToken?: string | null) {
  return createTrustedSessionSnapshot(accessToken, resolveTamiasUserSession);
}

export function getRequestAuthDependencies(): ResolveRequestAuthDependencies {
  return {
    internalApiKey: process.env.INTERNAL_API_KEY,
    resolveUserSession: resolveTamiasUserSession,
    async getOAuthAccessTokenByToken(token) {
      const record = await getOAuthAccessTokenByTokenFromConvex(token);

      if (!record?.teamId || !record.user?.id) {
        return null;
      }

      return {
        ...record,
        teamId: record.teamId,
        convexTeamId: record.convexTeamId ?? undefined,
        scopes: record.scopes ?? [],
        application: record.application ?? undefined,
        user: {
          id: record.user.id,
          convexId: record.user.convexId ?? undefined,
          email: record.user.email ?? undefined,
          fullName: record.user.fullName ?? undefined,
        },
      };
    },
    async getApiKeyByToken(token) {
      const record = await getApiKeyByTokenFromConvex(token);

      if (!record?.teamId || !record.user?.id) {
        return null;
      }

      return {
        ...record,
        teamId: record.teamId,
        convexTeamId: record.convexTeamId ?? undefined,
        scopes: record.scopes ?? [],
        user: {
          id: record.user.id,
          convexId: record.user.convexId ?? undefined,
          email: record.user.email ?? undefined,
          fullName: record.user.fullName ?? undefined,
        },
      };
    },
    async touchOAuthAccessToken(id) {
      await touchOAuthAccessTokenFromConvex(id);
    },
    async touchApiKey(id) {
      await touchApiKeyFromConvex(id);
    },
  };
}
