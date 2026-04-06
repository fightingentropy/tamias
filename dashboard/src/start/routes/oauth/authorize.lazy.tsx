import { createLazyFileRoute } from "@tanstack/react-router";
import { HydrationBoundary, type DehydratedState } from "@tanstack/react-query";
import { Suspense } from "react";
import { OAuthConsentScreen } from "@/components/oauth/oauth-consent-screen";
import { OAuthErrorMessage } from "@/components/oauth/oauth-error-message";
import { loadOAuthAuthorizeData } from "./authorize";

export const Route = createLazyFileRoute("/oauth/authorize")({
  component: OAuthAuthorizePage,
});

function OAuthAuthorizePage() {
  const loaderData = Route.useLoaderData() as Awaited<ReturnType<typeof loadOAuthAuthorizeData>>;

  if (loaderData.status === "error") {
    return (
      <OAuthErrorMessage
        errorType={loaderData.errorType}
        customMessage={loaderData.customMessage}
        details={loaderData.details}
      />
    );
  }

  return (
    <HydrationBoundary
      state={loaderData.dehydratedState as unknown as DehydratedState | null | undefined}
    >
      <Suspense fallback={null}>
        <OAuthConsentScreen />
      </Suspense>
    </HydrationBoundary>
  );
}
