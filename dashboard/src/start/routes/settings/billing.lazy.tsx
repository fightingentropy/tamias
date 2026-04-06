import { createLazyFileRoute } from "@tanstack/react-router";
import dynamic from "@/framework/dynamic";
import { AppLayoutShell } from "@/start/components/app-layout-shell";

function SectionFallback() {
  return <div className="min-h-24 rounded-lg border border-border/60" />;
}

const ManageSubscription = dynamic(
  () => import("@/components/manage-subscription").then((mod) => mod.ManageSubscription),
  {
    ssr: false,
    loading: SectionFallback,
  },
);

const Orders = dynamic(() => import("@/components/orders").then((mod) => mod.Orders), {
  ssr: false,
  loading: SectionFallback,
});

const Plans = dynamic(() => import("@/components/plans").then((mod) => mod.Plans), {
  ssr: false,
  loading: SectionFallback,
});

export const Route = createLazyFileRoute("/settings/billing")({
  component: SettingsBillingPage,
});

function SettingsBillingPage() {
  const loaderData = Route.useLoaderData();
  const team = loaderData.user.team;
  const shouldShowSubscription = Boolean(team && team.plan !== "trial");
  const shouldShowOrders = Boolean(team && (team.plan !== "trial" || team.canceledAt !== null));

  return (
    <AppLayoutShell dehydratedState={loaderData.dehydratedState} user={loaderData.user}>
      <div className="space-y-12">
        {shouldShowSubscription && <ManageSubscription />}

        {team?.plan === "trial" && (
          <div>
            <h2 className="font-serif text-2xl text-foreground mb-4">Plans</h2>

            <Plans />
          </div>
        )}

        {shouldShowOrders && <Orders />}
      </div>
    </AppLayoutShell>
  );
}
