import {
  getBankAccountsLocally,
  getBankConnectionsLocally,
} from "@/server/loaders/bank";
import { trpc } from "@/trpc/server";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
} from "@/start/server/route-data/shared";

export async function buildSettingsAccountsPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const bankConnectionsQuery = trpc.bankConnections.get.queryOptions();
  const manualBankAccountsQuery = trpc.bankAccounts.get.queryOptions({
    manual: true,
  });
  const [connections, manualAccounts] = await Promise.all([
    getBankConnectionsLocally(),
    getBankAccountsLocally({ manual: true }),
  ]);

  queryClient.setQueryData(bankConnectionsQuery.queryKey, connections);
  queryClient.setQueryData(manualBankAccountsQuery.queryKey, manualAccounts);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
