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
  await Promise.all([
    queryClient.fetchQuery(trpc.team.list.queryOptions()),
    queryClient.fetchQuery(trpc.user.invites.queryOptions()),
  ]);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
