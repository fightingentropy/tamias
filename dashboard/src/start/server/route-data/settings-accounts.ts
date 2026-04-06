import { batchPrefetch, trpc } from "@/trpc/server";
import { buildBaseAppShellState, dehydrateQueryClient } from "@/start/server/route-data/shared";

export async function buildSettingsAccountsPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const bankConnectionsQuery = trpc.bankConnections.get.queryOptions();
  const manualBankAccountsQuery = trpc.bankAccounts.get.queryOptions({
    manual: true,
  });

  await batchPrefetch([bankConnectionsQuery, manualBankAccountsQuery]);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
