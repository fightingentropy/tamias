import { getCountryCode, getCurrency } from "@tamias/location";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingPage } from "@/components/onboarding/onboarding-page";
import { getCurrentUserLocally } from "@/server/loaders/identity";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Onboarding | Tamias",
};

export default async function Page() {
  const queryClient = getQueryClient();

  const user = await getCurrentUserLocally().catch(() => redirect("/login"));
  queryClient.setQueryData(trpc.user.me.queryKey(), user);

  if (!user) {
    redirect("/login");
  }

  const currency = getCurrency();
  const countryCode = getCountryCode();

  return (
    <HydrateClient>
      <OnboardingPage
        defaultCurrencyPromise={currency}
        defaultCountryCodePromise={countryCode}
        user={{
          id: user.id,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl ?? null,
          teamId: user.teamId,
        }}
      />
    </HydrateClient>
  );
}
