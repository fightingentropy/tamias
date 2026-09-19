import { createLazyFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@tamias/ui/tabs";
import { StatementAnalytics } from "@/components/metrics/statement-analytics";
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
        <header className="mt-6 mb-6 space-y-2">
          <h1 className="text-3xl font-serif">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Explore your statements, spending and cash flow.
          </p>
        </header>
        <Tabs defaultValue="statements">
          <TabsList aria-label="Report type">
            <TabsTrigger value="statements">Statement analytics</TabsTrigger>
            <TabsTrigger value="business">Business metrics</TabsTrigger>
          </TabsList>
          <TabsContent value="statements">
            <StatementAnalytics />
          </TabsContent>
          <TabsContent value="business">
            <div className="flex items-center justify-end gap-2 mb-6 mt-6" data-no-close>
              <ReportsCustomize />
              <MetricsFilter />
            </div>
            <MetricsView />
          </TabsContent>
        </Tabs>
      </ScrollableContent>
    </AppLayoutShell>
  );
}
