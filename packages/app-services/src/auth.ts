import {
  createTrustedSessionSnapshot,
  createUserSessionResolver,
  type ApiKeyRecord,
  type OAuthAccessTokenRecord,
  type ResolveRequestAuthDependencies,
  type SessionResolverDependencies,
} from "@tamias/auth-session";
import { verifyServiceIdentityTokenFromEnvironment } from "@tamias/auth-session/service-identity";
import { getApiKeyByTokenFromD1, touchApiKeyInD1 } from "./foundation";
import { getOAuthAccessTokenByTokenFromD1, touchOAuthAccessTokenInD1 } from "./oauth";
import { ensureCurrentUser, getCurrentUser, getTeamMembershipIds } from "./identity";

export const sessionResolverDependencies: SessionResolverDependencies = {
  ensureCurrentUser,
  getTeamMembershipIds,
  getCurrentUser,
};

export const resolveTamiasUserSession = createUserSessionResolver(sessionResolverDependencies);

export async function createTamiasTrustedSessionSnapshot(accessToken?: string | null) {
  return createTrustedSessionSnapshot(accessToken, resolveTamiasUserSession);
}

export function getRequestAuthDependencies(): ResolveRequestAuthDependencies {
  return {
    dashboardSessionKey: process.env.TAMIAS_DASHBOARD_SESSION_KEY,
    verifyServiceIdentity: verifyServiceIdentityTokenFromEnvironment,
    resolveUserSession: resolveTamiasUserSession,
    async getOAuthAccessTokenByToken(token) {
      const record = await getOAuthAccessTokenByTokenFromD1(token);

      if (!record?.teamId || !record.user?.id) {
        return null;
      }

      return {
        id: record.id,
        applicationId: record.applicationId,
        teamId: record.teamId,
        scopes: record.scopes ?? [],
        application: record.application
          ? {
              clientId: record.application.clientId,
              name: record.application.name,
            }
          : undefined,
        user: {
          id: record.user.id as NonNullable<OAuthAccessTokenRecord["user"]>["id"],
          email: record.user.email ?? undefined,
          fullName: record.user.fullName ?? undefined,
        },
      };
    },
    async getApiKeyByToken(token) {
      const record = await getApiKeyByTokenFromD1(token);

      if (!record?.teamId || !record.user?.id) {
        return null;
      }

      return {
        id: record.id,
        teamId: record.teamId,
        scopes: record.scopes ?? [],
        user: {
          id: record.user.id as NonNullable<ApiKeyRecord["user"]>["id"],
          email: record.user.email ?? undefined,
          fullName: record.user.fullName ?? undefined,
        },
      };
    },
    async touchOAuthAccessToken(id) {
      await touchOAuthAccessTokenInD1(id);
    },
    async touchApiKey(id) {
      await touchApiKeyInD1(id);
    },
  };
}
