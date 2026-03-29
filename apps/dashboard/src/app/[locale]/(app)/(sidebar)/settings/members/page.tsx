import type { Metadata } from "next";
import { TeamMembers } from "@/components/team-members";
import {
  getCurrentTeamInvitesLocally,
  getCurrentTeamMembersLocally,
} from "@/server/loaders/identity";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Members | Tamias",
};

export default async function Members() {
  const queryClient = getQueryClient();
  const [members, invites] = await Promise.all([
    getCurrentTeamMembersLocally(),
    getCurrentTeamInvitesLocally(),
  ]);

  queryClient.setQueryData(trpc.team.members.queryKey(), members);
  queryClient.setQueryData(trpc.team.teamInvites.queryKey(), invites);

  return (
    <HydrateClient>
      <TeamMembers />
    </HydrateClient>
  );
}
