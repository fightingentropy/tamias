import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Suspense } from "react";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { Apps } from "@/components/apps";
import { AppsSkeleton } from "@/components/apps.skeleton";
import { AppsHeader } from "@/components/apps-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";

const loadAppsData = createServerFn({ method: "GET" }).handler(async () => {
  const { buildAppsPageData } = await import("@/start/server/route-data");
  return (await buildAppsPageData()) as any;
});

export const Route = createFileRoute("/apps")({
  loader: () => loadAppsData(),
  head: () => ({
    meta: [{ title: "Apps | Tamias" }],
  }),
  component: AppsPage,
});

function AppsPage() {
  const loaderData = Route.useLoaderData() as Awaited<ReturnType<typeof loadAppsData>>;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <div className="mt-4">
        <AppsHeader />

        <ErrorBoundary errorComponent={ErrorFallback}>
          <Suspense fallback={<AppsSkeleton />}>
            <Apps />
          </Suspense>
        </ErrorBoundary>
      </div>
    </AppLayoutShell>
  );
}
