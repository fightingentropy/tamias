import { createLazyFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import { OpenTrackerSheet } from "@/components/open-tracker-sheet";
import { ScrollableContent } from "@/components/scrollable-content";
import { DataTable } from "@/components/tables/tracker";
import { Loading } from "@/components/tables/tracker/loading";
import { TrackerCalendar } from "@/components/tracker-calendar";
import { TrackerSearchFilter } from "@/components/tracker-search-filter";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import type { TrackerLoaderData } from "./tracker";

export const Route = createLazyFileRoute("/tracker")({
  component: TrackerPage,
});

function TrackerPage() {
  const loaderData = Route.useLoaderData() as TrackerLoaderData;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <ScrollableContent>
        <TrackerCalendar weeklyCalendar={loaderData.weeklyCalendar} />

        <div className="mt-14 mb-6 flex items-center justify-between space-x-4">
          <h2 className="text-md font-medium">Projects</h2>

          <div className="flex space-x-2">
            <TrackerSearchFilter />
            <OpenTrackerSheet />
          </div>
        </div>

        <ErrorBoundary errorComponent={ErrorFallback}>
          <Suspense fallback={<Loading />}>
            <DataTable />
          </Suspense>
        </ErrorBoundary>
      </ScrollableContent>
    </AppLayoutShell>
  );
}
