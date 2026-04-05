import { type DehydratedState, HydrationBoundary } from "@tanstack/react-query";
import { createLazyFileRoute } from "@tanstack/react-router";
import { OnboardingPage } from "@/components/onboarding/onboarding-page";
import type { OnboardingPageLoaderData } from "@/start/server/route-data/misc";

export const Route = createLazyFileRoute("/onboarding")({
  component: OnboardingRouteComponent,
});

function OnboardingRouteComponent() {
  const loaderData = Route.useLoaderData() as OnboardingPageLoaderData;

  return (
    <HydrationBoundary
      state={
        loaderData.dehydratedState as unknown as
          | DehydratedState
          | null
          | undefined
      }
    >
      <OnboardingPage
        defaultCurrencyPromise={Promise.resolve(
          loaderData.defaultCurrency ?? "",
        )}
        defaultCountryCodePromise={Promise.resolve(
          loaderData.defaultCountryCode,
        )}
        user={{
          id: loaderData.user.id,
          fullName: loaderData.user.fullName,
          avatarUrl: loaderData.user.avatarUrl ?? null,
          teamId: loaderData.user.teamId,
        }}
      />
    </HydrationBoundary>
  );
}
