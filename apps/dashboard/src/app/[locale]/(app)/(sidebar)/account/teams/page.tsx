import type { Metadata } from "next";
import { ErrorBoundary } from "next/dist/client/components/error-boundary";
import { Suspense } from "react";
import { ErrorFallback } from "@/components/error-fallback";
import { TeamsTable } from "@/components/tables/teams";
import { TeamsSkeleton } from "@/components/tables/teams/skeleton";
import {
  getCurrentUserInvitesLocally,
  getCurrentUserTeamsLocally,
} from "@/server/loaders/identity";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Teams | Tamias",
};

export default async function Teams() {
  const queryClient = getQueryClient();
  const [teams, invites] = await Promise.all([
    getCurrentUserTeamsLocally(),
    getCurrentUserInvitesLocally(),
  ]);

  queryClient.setQueryData(trpc.team.list.queryKey(), teams);
  queryClient.setQueryData(trpc.user.invites.queryKey(), invites);

  return (
    <ErrorBoundary errorComponent={ErrorFallback}>
      <Suspense fallback={<TeamsSkeleton />}>
        <TeamsTable />
      </Suspense>
    </ErrorBoundary>
  );
}
