import { getCurrencyForCountry, getLocationHeaders } from "@tamias/location";
import { redirect } from "@tanstack/react-router";
import { getStartContext } from "@tanstack/start-storage-context";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
} from "@/start/server/route-data/shared";
import { trpc } from "@/trpc/server";
import { geolocation } from "@/utils/geo";

export async function buildUpgradePageData() {
  const { queryClient, user } = await buildBaseAppShellState();

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildTeamsSelectionPageData() {
  const { queryClient, user } = await buildBaseAppShellState({
    allowIncomplete: true,
  });
  const teamsQuery = trpc.team.list.queryOptions();
  const invitesQuery = trpc.team.invitesByEmail.queryOptions();
  const [teams, invites] = await Promise.all([
    queryClient.fetchQuery(teamsQuery),
    queryClient.fetchQuery(invitesQuery),
  ]);

  if (!teams.length && !invites.length) {
    throw redirect({
      to: "/onboarding",
      throw: true,
    });
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    teams,
    invites,
  };
}

export async function buildChatPageData(id: string) {
  const { queryClient, user } = await buildBaseAppShellState();
  const chat = await queryClient.fetchQuery(
    trpc.chats.get.queryOptions({ chatId: id }),
  );

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    chat,
    geo: geolocation(getStartContext().request.headers as Headers),
  };
}

export type ChatPageLoaderData = Awaited<ReturnType<typeof buildChatPageData>>;

export async function buildOnboardingPageData() {
  const { queryClient, user } = await buildBaseAppShellState({
    allowIncomplete: true,
  });
  const location = getLocationHeaders(
    getStartContext().request.headers as Headers,
  );

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    defaultCurrency: getCurrencyForCountry(location.country),
    defaultCountryCode: location.country,
  };
}

export type OnboardingPageLoaderData = Awaited<
  ReturnType<typeof buildOnboardingPageData>
>;
