import {
  getCurrentUserInvitesLocally,
  getCurrentUserTeamsLocally,
} from "@/server/loaders/identity";
import { trpc } from "@/trpc/server";
import {
  buildBaseAppShellState,
  buildShellOnlyPageData,
  dehydrateQueryClient,
} from "@/start/server/route-data/shared";

export async function buildAccountPageData() {
  return buildShellOnlyPageData();
}

export async function buildAccountDateAndLocalePageData() {
  return buildShellOnlyPageData();
}

export async function buildAccountSecurityPageData() {
  return buildShellOnlyPageData();
}

export async function buildAccountSupportPageData() {
  return buildShellOnlyPageData();
}

export async function buildAccountTeamsPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const [teams, invites] = await Promise.all([
    getCurrentUserTeamsLocally(),
    getCurrentUserInvitesLocally(),
  ]);

  queryClient.setQueryData(trpc.team.list.queryKey(), teams);
  queryClient.setQueryData(trpc.user.invites.queryKey(), invites);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
