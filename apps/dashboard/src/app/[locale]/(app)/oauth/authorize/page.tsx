import type { Metadata } from "next";
import type { SearchParams } from "nuqs";
import { Suspense } from "react";
import { OAuthConsentScreen } from "@/components/oauth/oauth-consent-screen";
import { OAuthErrorMessage } from "@/components/oauth/oauth-error-message";
import { loadOAuthParams } from "@/hooks/use-oauth-params";
import {
  getCurrentTeamLocally,
  getCurrentUserTeamsLocally,
} from "@/server/loaders/identity";
import { getOAuthApplicationInfoLocally } from "@/server/loaders/apps";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { categorizeOAuthError, validateOAuthParams } from "@/utils/oauth-utils";

export const metadata: Metadata = {
  title: "Authorize API Access | Tamias",
};

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: Props) {
  const searchParams = await props.searchParams;
  const { response_type, client_id, redirect_uri, scope, state } =
    loadOAuthParams(searchParams);

  // Validate OAuth parameters
  const validation = validateOAuthParams({
    response_type: response_type || undefined,
    client_id: client_id || undefined,
    redirect_uri: redirect_uri || undefined,
    scope: scope || undefined,
  });

  if (!validation.isValid) {
    return (
      <HydrateClient>
        <OAuthErrorMessage errorType={validation.errorType!} />
      </HydrateClient>
    );
  }

  // Validate OAuth application and parameters
  try {
    const queryClient = getQueryClient();
    const applicationInfoQuery =
      trpc.oauthApplications.getApplicationInfo.queryOptions({
        clientId: client_id!,
        redirectUri: redirect_uri!,
        scope: scope!,
        state: state || undefined,
      });

    // Validate the OAuth application info first
    const applicationInfo = await getOAuthApplicationInfoLocally({
      clientId: client_id!,
      redirectUri: redirect_uri!,
      scope: scope!,
      state: state || undefined,
    });

    // If validation passes, prefetch additional data for hydration
    const [teams, currentTeam] = await Promise.all([
      getCurrentUserTeamsLocally(),
      getCurrentTeamLocally(),
    ]);

    queryClient.setQueryData(applicationInfoQuery.queryKey, applicationInfo);
    queryClient.setQueryData(trpc.team.list.queryKey(), teams);
    queryClient.setQueryData(trpc.team.current.queryKey(), currentTeam);

    // Render the consent screen
    return (
      <HydrateClient>
        <Suspense>
          <OAuthConsentScreen />
        </Suspense>
      </HydrateClient>
    );
  } catch (error) {
    // Handle different types of validation errors
    const { errorType, customMessage, details } = categorizeOAuthError(error);

    return (
      <HydrateClient>
        <OAuthErrorMessage
          errorType={errorType}
          customMessage={customMessage}
          details={details}
        />
      </HydrateClient>
    );
  }
}
