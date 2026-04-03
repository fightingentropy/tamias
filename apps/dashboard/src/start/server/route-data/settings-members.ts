import {
  getCurrentTeamInvitesLocally,
  getCurrentTeamMembersLocally,
} from "@/server/loaders/identity";
import { trpc } from "@/trpc/server";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
} from "@/start/server/route-data/shared";

export async function buildSettingsMembersPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const [members, invites] = await Promise.all([
    getCurrentTeamMembersLocally(),
    getCurrentTeamInvitesLocally(),
  ]);

  queryClient.setQueryData(trpc.team.members.queryKey(), members);
  queryClient.setQueryData(trpc.team.teamInvites.queryKey(), invites);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
