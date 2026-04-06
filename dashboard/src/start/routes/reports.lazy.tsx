import { createLazyFileRoute } from "@tanstack/react-router";
import { MetricsView } from "@/components/metrics/metrics-view";
import { MetricsFilter } from "@/components/metrics/components/metrics-filter";
import { ReportsCustomize } from "@/components/reports-customize";
import { ScrollableContent } from "@/components/scrollable-content";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import type { ReportsLoaderData } from "./reports";

export const Route = createLazyFileRoute("/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const loaderData = Route.useLoaderData() as ReportsLoaderData;

  return (
    <AppLayoutShell dehydratedState={loaderData.dehydratedState} user={loaderData.user}>
      <ScrollableContent>
        <div className="flex items-center justify-end gap-2 mb-6 mt-6" data-no-close>
          <ReportsCustomize />
          <MetricsFilter />
        </div>
        <MetricsView />
      </ScrollableContent>
    </AppLayoutShell>
  );
}
