import { hash } from "@tamias/encryption";
import { api } from "@tamias/app-data/convex/api";
import type { Id } from "@tamias/app-data/convex/data-model";
import { createConvexClient, getConvexServiceKey } from "./convex-client";

type ConvexUserId = Id<"appUsers">;

function getClient() {
  return createConvexClient();
}

function serviceArgs<T extends Record<string, unknown>>(args: T) {
  return {
    serviceKey: getConvexServiceKey(),
    ...args,
  };
}

export async function getTeamByPublicTeamIdFromConvex(publicTeamId: string) {
  return getClient().query(
    api.foundation.serviceGetTeamByPublicTeamId,
    serviceArgs({ publicTeamId }),
  );
}

export async function getApiKeyByTokenFromConvex(token: string) {
  return getClient().query(
    api.foundation.serviceGetApiKeyByHash,
    serviceArgs({ keyHash: hash(token) }),
  );
}

export async function getApiKeysByTeamFromConvex(publicTeamId: string) {
  return getClient().query(
    api.foundation.serviceListApiKeysByTeam,
    serviceArgs({ publicTeamId }),
  );
}

export async function touchApiKeyFromConvex(publicApiKeyId: string) {
  return getClient().mutation(
    api.foundation.serviceTouchApiKey,
    serviceArgs({ publicApiKeyId }),
  );
}

export async function createApiKeyInConvex(args: {
  userId: ConvexUserId;
  publicTeamId: string;
  name: string;
  scopes: string[];
}) {
  return getClient().action(
    api.foundationActions.serviceCreateApiKey,
    serviceArgs(args),
  );
}

export async function updateApiKeyInConvex(args: {
  publicApiKeyId: string;
  publicTeamId: string;
  name: string;
  scopes: string[];
}) {
  return getClient().action(
    api.foundationActions.serviceUpdateApiKey,
    serviceArgs(args),
  );
}

export async function deleteApiKeyInConvex(args: {
  publicApiKeyId: string;
  publicTeamId: string;
}) {
  return getClient().mutation(
    api.foundation.serviceDeleteApiKey,
    serviceArgs(args),
  );
}

export async function getOAuthApplicationByClientIdFromConvex(
  clientId: string,
) {
  return getClient().query(
    api.foundation.serviceGetOAuthApplicationByClientId,
    serviceArgs({ clientId }),
  );
}

export async function getOAuthApplicationByIdFromConvex(args: {
  publicApplicationId: string;
  publicTeamId?: string;
}) {
  return getClient().query(
    api.foundation.serviceGetOAuthApplicationById,
    serviceArgs(args),
  );
}

export async function getOAuthApplicationsByTeamFromConvex(
  publicTeamId: string,
) {
  return getClient().query(
    api.foundation.serviceListOAuthApplicationsByTeam,
    serviceArgs({ publicTeamId }),
  );
}

export async function createOAuthApplicationInConvex(args: {
  publicTeamId: string;
  createdByUserId: ConvexUserId;
  name: string;
  description?: string;
  overview?: string;
  developerName?: string;
  logoUrl?: string;
  website?: string;
  installUrl?: string;
  screenshots?: string[];
  redirectUris: string[];
  scopes: string[];
  isPublic: boolean;
}) {
  return getClient().action(
    api.foundationActions.serviceCreateOAuthApplication,
    serviceArgs(args),
  );
}

export async function updateOAuthApplicationInConvex(args: {
  publicApplicationId: string;
  publicTeamId: string;
  name?: string;
  description?: string | null;
  overview?: string | null;
  developerName?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  installUrl?: string | null;
  screenshots?: string[];
  redirectUris?: string[];
  scopes?: string[];
  isPublic?: boolean;
  active?: boolean;
}) {
  return getClient().mutation(
    api.foundation.serviceUpdateOAuthApplication,
    serviceArgs(args),
  );
}

export async function deleteOAuthApplicationInConvex(args: {
  publicApplicationId: string;
  publicTeamId: string;
}) {
  return getClient().mutation(
    api.foundation.serviceDeleteOAuthApplication,
    serviceArgs(args),
  );
}

export async function regenerateOAuthClientSecretInConvex(args: {
  publicApplicationId: string;
  publicTeamId: string;
}) {
  return getClient().action(
    api.foundationActions.serviceRegenerateOAuthClientSecret,
    serviceArgs(args),
  );
}

export async function updateOAuthApplicationStatusInConvex(args: {
  publicApplicationId: string;
  publicTeamId: string;
  status: "draft" | "pending" | "approved" | "rejected";
}) {
  return getClient().mutation(
    api.foundation.serviceUpdateOAuthApplicationStatus,
    serviceArgs(args),
  );
}

export async function createAuthorizationCodeInConvex(args: {
  publicApplicationId: string;
  userId: ConvexUserId;
  publicTeamId: string;
  scopes: string[];
  redirectUri: string;
  codeChallenge?: string;
}) {
  return getClient().action(
    api.foundationActions.serviceCreateAuthorizationCode,
    serviceArgs(args),
  );
}

export async function exchangeAuthorizationCodeInConvex(args: {
  code: string;
  redirectUri: string;
  publicApplicationId: string;
  codeVerifier?: string;
}) {
  return getClient().action(
    api.foundationActions.serviceExchangeAuthorizationCode,
    serviceArgs(args),
  );
}

export async function getOAuthAccessTokenByTokenFromConvex(token: string) {
  return getClient().query(
    api.foundation.serviceGetAccessTokenByHash,
    serviceArgs({ tokenHash: hash(token) }),
  );
}

export async function touchOAuthAccessTokenFromConvex(
  publicAccessTokenId: string,
) {
  return getClient().mutation(
    api.foundation.serviceTouchOAuthAccessToken,
    serviceArgs({ publicAccessTokenId }),
  );
}

export async function refreshAccessTokenInConvex(args: {
  refreshToken: string;
  publicApplicationId: string;
  scopes?: string[];
}) {
  return getClient().action(
    api.foundationActions.serviceRefreshAccessToken,
    serviceArgs({
      publicApplicationId: args.publicApplicationId,
      refreshTokenHash: hash(args.refreshToken),
      scopes: args.scopes,
    }),
  );
}

export async function revokeAccessTokenInConvex(args: {
  token: string;
  publicApplicationId?: string;
}) {
  return getClient().mutation(
    api.foundation.serviceRevokeAccessTokenByHash,
    serviceArgs({
      publicApplicationId: args.publicApplicationId,
      tokenHash: hash(args.token),
    }),
  );
}

export async function getUserAuthorizedApplicationsFromConvex(args: {
  userId: ConvexUserId;
  publicTeamId: string;
}) {
  return getClient().query(
    api.foundation.serviceGetUserAuthorizedApplications,
    serviceArgs(args),
  );
}

export async function hasUserEverAuthorizedAppInConvex(args: {
  publicApplicationId: string;
  userId: ConvexUserId;
  publicTeamId: string;
}) {
  return getClient().query(
    api.foundation.serviceHasUserEverAuthorizedApp,
    serviceArgs(args),
  );
}

export async function revokeUserApplicationTokensInConvex(args: {
  publicApplicationId: string;
  userId: ConvexUserId;
}) {
  return getClient().mutation(
    api.foundation.serviceRevokeUserApplicationTokens,
    serviceArgs(args),
  );
}
