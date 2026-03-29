import type { Metadata } from "next";
import { ConnectedAccounts } from "@/components/connected-accounts";
import {
  getBankAccountsLocally,
  getBankConnectionsLocally,
} from "@/server/loaders/bank";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Bank Connections | Tamias",
};

export default async function Page() {
  const queryClient = getQueryClient();
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

  return (
    <HydrateClient>
      <div className="space-y-12">
        <ConnectedAccounts />
      </div>
    </HydrateClient>
  );
}
