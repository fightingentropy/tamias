import { batchPrefetch, trpc } from "@/trpc/server";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
} from "@/start/server/route-data/shared";

export async function buildReportsPageData(_href?: string) {
  const { queryClient, user } = await buildBaseAppShellState();

  const bankConnectionsQuery = trpc.bankConnections.get.queryOptions();
  await batchPrefetch([bankConnectionsQuery]);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
