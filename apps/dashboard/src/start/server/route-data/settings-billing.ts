import {
  getActiveSubscriptionLocally,
  getBillingOrdersLocally,
} from "@/server/loaders/billing";
import { trpc } from "@/trpc/server";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
} from "@/start/server/route-data/shared";

export async function buildSettingsBillingPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const team = user.team;
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

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
