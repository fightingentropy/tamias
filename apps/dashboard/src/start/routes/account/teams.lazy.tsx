import { createLazyFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import { TeamsTable } from "@/components/tables/teams";
import { TeamsSkeleton } from "@/components/tables/teams/skeleton";
import { loadAccountTeamsData } from "./teams";

export const Route = createLazyFileRoute("/account/teams")({
  component: AccountTeamsPage,
});

function AccountTeamsPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadAccountTeamsData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <ErrorBoundary errorComponent={ErrorFallback}>
        <Suspense fallback={<TeamsSkeleton />}>
          <TeamsTable />
        </Suspense>
      </ErrorBoundary>
    </AppLayoutShell>
  );
}
