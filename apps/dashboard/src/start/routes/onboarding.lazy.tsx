import { createLazyFileRoute } from "@tanstack/react-router";
import {
  HydrationBoundary,
  type DehydratedState,
} from "@tanstack/react-query";
import { OnboardingPage } from "@/components/onboarding/onboarding-page";
import { loadOnboardingData } from "./onboarding";

export const Route = createLazyFileRoute("/onboarding")({
  component: OnboardingRouteComponent,
});

function OnboardingRouteComponent() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadOnboardingData>
  >;

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
        defaultCurrencyPromise={Promise.resolve(loaderData.defaultCurrency)}
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
