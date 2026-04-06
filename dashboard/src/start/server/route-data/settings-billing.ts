import { buildBaseAppShellState, dehydrateQueryClient } from "@/start/server/route-data/shared";

export async function buildSettingsBillingPageData() {
  const { queryClient, user } = await buildBaseAppShellState();

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
