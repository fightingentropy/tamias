import {
  HydrationBoundary,
  type DehydratedState,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Suspense } from "react";
import { OAuthConsentScreen } from "@/components/oauth/oauth-consent-screen";
import { OAuthErrorMessage } from "@/components/oauth/oauth-error-message";

const loadOAuthAuthorizeData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildOAuthAuthorizePageData } = await import(
      "@/start/server/route-data"
    );

    return (await buildOAuthAuthorizePageData(data.href)) as any;
  });

export const Route = createFileRoute("/oauth/authorize")({
  loader: ({ location }) =>
    loadOAuthAuthorizeData({
      data: {
        href: location.href,
      },
    }),
  head: () => ({
    meta: [{ title: "Authorize API Access | Tamias" }],
  }),
  component: OAuthAuthorizePage,
});

function OAuthAuthorizePage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadOAuthAuthorizeData>
  >;

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
      state={
        loaderData.dehydratedState as unknown as
          | DehydratedState
          | null
          | undefined
      }
    >
      <Suspense fallback={null}>
        <OAuthConsentScreen />
      </Suspense>
    </HydrationBoundary>
  );
}
