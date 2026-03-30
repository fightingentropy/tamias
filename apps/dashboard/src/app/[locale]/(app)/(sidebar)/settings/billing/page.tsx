import type { Metadata } from "next";
import { ManageSubscription } from "@/components/manage-subscription";
import { Orders } from "@/components/orders";
import { Plans } from "@/components/plans";
import {
  getActiveSubscriptionLocally,
  getBillingOrdersLocally,
} from "@/server/loaders/billing";
import { getCurrentUserLocally } from "@/server/loaders/identity";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Billing | Tamias",
};

export default async function Billing() {
  const queryClient = getQueryClient();
  const user = await getCurrentUserLocally();
  queryClient.setQueryData(trpc.user.me.queryKey(), user);

  const team = user?.team;
  const shouldShowSubscription = Boolean(team && team.plan !== "trial");
  const shouldShowOrders = Boolean(
    team && (team.plan !== "trial" || team.canceledAt !== null),
  );
  const ordersQuery = trpc.billing.orders.infiniteQueryOptions(
    {
      pageSize: 15,
    },
    {
      getNextPageParam: ({ meta }) => meta?.cursor,
    },
  );
  const activeSubscriptionQuery =
    trpc.billing.getActiveSubscription.queryOptions();

  const [orders, activeSubscription] = await Promise.all([
    shouldShowOrders ? getBillingOrdersLocally(undefined, 15) : null,
    shouldShowSubscription ? getActiveSubscriptionLocally() : null,
  ]);

  if (orders) {
    queryClient.setQueryData(ordersQuery.queryKey, {
      pages: [orders],
      pageParams: [null],
    });
  }

  if (shouldShowSubscription) {
    queryClient.setQueryData(
      activeSubscriptionQuery.queryKey,
      activeSubscription,
    );
  }

  return (
    <HydrateClient>
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
    </HydrateClient>
  );
}
