import { batchPrefetch, trpc } from "@/trpc/server";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
} from "@/start/server/route-data/shared";

export async function buildAppsPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const installedAppsQuery = trpc.apps.get.queryOptions();
  const oauthApplicationsQuery = trpc.oauthApplications.list.queryOptions();
  const authorizedApplicationsQuery =
    trpc.oauthApplications.authorized.queryOptions();
  const inboxAccountsQuery = trpc.inboxAccounts.get.queryOptions();
  const stripeStatusQuery = trpc.invoicePayments.stripeStatus.queryOptions();

  await batchPrefetch([
    installedAppsQuery,
    oauthApplicationsQuery,
    authorizedApplicationsQuery,
    inboxAccountsQuery,
    stripeStatusQuery,
  ]);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
