import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Suspense } from "react";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import { TeamsTable } from "@/components/tables/teams";
import { TeamsSkeleton } from "@/components/tables/teams/skeleton";

const loadAccountTeamsData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildAccountTeamsPageData } = await import(
      "@/start/server/route-data"
    );
    return (await buildAccountTeamsPageData()) as any;
  },
);

export const Route = createFileRoute("/account/teams")({
  loader: () => loadAccountTeamsData(),
  head: () => ({
    meta: [{ title: "Teams | Tamias" }],
  }),
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
