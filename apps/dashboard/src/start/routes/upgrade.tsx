import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import Link from "@/framework/link";
import { OpenURL } from "@/components/open-url";
import { Plans } from "@/components/plans";
import { UpgradeFAQ } from "@/components/upgrade-faq";
import { getTrialDaysLeft } from "@/utils/trial";

const loadUpgradeData = createServerFn({ method: "GET" }).handler(async () => {
  const { buildUpgradePageData } = await import("@/start/server/route-data");
  return (await buildUpgradePageData()) as any;
});

export const Route = createFileRoute("/upgrade")({
  loader: () => loadUpgradeData(),
  head: () => ({
    meta: [{ title: "Upgrade | Tamias" }],
  }),
  component: UpgradePage,
});

function UpgradePage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadUpgradeData>
  >;
  const team = loaderData.user.team;

  if (!team || team.plan !== "trial") {
    return null;
  }

  const daysLeft = getTrialDaysLeft(team.createdAt);
  const trialEnded = !daysLeft || daysLeft <= 0;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] md:py-6 md:-ml-8">
        <div className="w-full max-w-[960px] p-8">
          <div className="mb-8 md:mt-8 text-center">
            <h1 className="font-serif text-2xl text-foreground mb-2">
              Continue with Tamias
            </h1>
            <p className="font-sans text-base text-muted-foreground leading-normal">
              {trialEnded
                ? "Your trial has ended — subscribe to pick up where you left off."
                : `Your trial ends in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}.`}
            </p>
          </div>

          <Plans />

          <UpgradeFAQ />

          <p className="text-xs text-muted-foreground mt-8 text-center">
            Questions?{" "}
            <Link href="/account/support" className="hover:underline">
              Contact support
            </Link>{" "}
            or{" "}
            <OpenURL
              href="https://cal.com/pontus-tamias/15min"
              className="hover:underline"
            >
              book a call with the founders
            </OpenURL>
            .
          </p>
        </div>
      </div>
    </AppLayoutShell>
  );
}
