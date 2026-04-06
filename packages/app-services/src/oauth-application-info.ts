import { getOAuthApplicationByClientIdFromConvex } from "./foundation";

export type OAuthApplicationInfoInput = {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
};

export async function getOAuthApplicationInfo(input: OAuthApplicationInfoInput) {
  const { clientId, redirectUri, scope, state } = input;
  const application = await getOAuthApplicationByClientIdFromConvex(clientId);

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
