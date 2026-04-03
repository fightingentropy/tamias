import {
  getApiKeysLocally,
  getOAuthApplicationsLocally,
} from "@/server/loaders/apps";
import { trpc } from "@/trpc/server";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
} from "@/start/server/route-data/shared";

export async function buildSettingsDeveloperPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const apiKeysQuery = trpc.apiKeys.get.queryOptions();
  const oauthApplicationsQuery = trpc.oauthApplications.list.queryOptions();
  const [apiKeysResult, oauthApplicationsResult] = await Promise.allSettled([
    getApiKeysLocally(),
    getOAuthApplicationsLocally(),
  ]);

  if (apiKeysResult.status === "fulfilled") {
    queryClient.setQueryData(apiKeysQuery.queryKey, apiKeysResult.value);
  }

  if (oauthApplicationsResult.status === "fulfilled") {
    queryClient.setQueryData(
      oauthApplicationsQuery.queryKey,
      oauthApplicationsResult.value,
    );
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
