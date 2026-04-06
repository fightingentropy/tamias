import { batchPrefetch, trpc } from "@/trpc/server";
import { buildBaseAppShellState, dehydrateQueryClient } from "@/start/server/route-data/shared";

export async function buildSettingsDeveloperPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const apiKeysQuery = trpc.apiKeys.get.queryOptions();
  const oauthApplicationsQuery = trpc.oauthApplications.list.queryOptions();

  await batchPrefetch([apiKeysQuery, oauthApplicationsQuery]);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
