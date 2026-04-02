import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { ManageSubscription } from "@/components/manage-subscription";
import { Orders } from "@/components/orders";
import { Plans } from "@/components/plans";

const loadSettingsBillingData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildSettingsBillingPageData } = await import(
      "@/start/server/route-data"
    );
    return (await buildSettingsBillingPageData()) as any;
  },
);

export const Route = createFileRoute("/settings/billing")({
  loader: () => loadSettingsBillingData(),
  head: () => ({
    meta: [{ title: "Billing | Tamias" }],
  }),
  component: SettingsBillingPage,
});

function SettingsBillingPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadSettingsBillingData>
  >;
  const team = loaderData.user.team;
  const shouldShowSubscription = Boolean(team && team.plan !== "trial");
  const shouldShowOrders = Boolean(
    team && (team.plan !== "trial" || team.canceledAt !== null),
  );

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
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
