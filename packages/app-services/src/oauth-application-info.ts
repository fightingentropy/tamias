import type { Database } from "@tamias/app-data/client";
import { getOAuthApplicationByClientIdFromD1 } from "./oauth";

export type OAuthApplicationInfoInput = {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
};

export async function getOAuthApplicationInfo(input: OAuthApplicationInfoInput, db?: Database) {
  const { clientId, redirectUri, scope, state } = input;
  const application = await getOAuthApplicationByClientIdFromD1(clientId, db);

  if (!application || !application.active) {
    throw new Error("Invalid client_id");
  }

  if (!application.redirectUris.includes(redirectUri)) {
    throw new Error("Invalid redirect_uri");
  }

  const requestedScopes = scope.split(" ").filter(Boolean);
  const invalidScopes = requestedScopes.filter(
    (requestedScope) => !application.scopes.includes(requestedScope),
  );

  if (invalidScopes.length > 0) {
    throw new Error(`Invalid scopes: ${invalidScopes.join(", ")}`);
  }

  return {
    id: application.id,
    name: application.name,
    description: application.description,
    overview: application.overview,
    developerName: application.developerName,
    logoUrl: application.logoUrl,
    website: application.website,
    installUrl: application.installUrl,
    screenshots: application.screenshots,
    clientId: application.clientId,
    scopes: requestedScopes,
    redirectUri,
    state,
    status: application.status,
  };
}
