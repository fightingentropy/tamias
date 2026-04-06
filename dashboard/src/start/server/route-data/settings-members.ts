import { batchPrefetch, trpc } from "@/trpc/server";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
} from "@/start/server/route-data/shared";

export async function buildSettingsMembersPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  await batchPrefetch([
    trpc.team.members.queryOptions(),
    trpc.team.teamInvites.queryOptions(),
  ]);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
