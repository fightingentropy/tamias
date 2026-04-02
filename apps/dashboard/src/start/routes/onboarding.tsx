import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  HydrationBoundary,
  type DehydratedState,
} from "@tanstack/react-query";
import { OnboardingPage } from "@/components/onboarding/onboarding-page";

const loadOnboardingData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildOnboardingPageData } = await import("@/start/server/route-data");
    return (await buildOnboardingPageData()) as any;
  },
);

export const Route = createFileRoute("/onboarding")({
  loader: () => loadOnboardingData(),
  head: () => ({
    meta: [{ title: "Onboarding | Tamias" }],
  }),
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
