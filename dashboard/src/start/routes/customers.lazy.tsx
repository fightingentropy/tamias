import { createLazyFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { CollapsibleSummary } from "@/components/collapsible-summary";
import { CustomerSummarySkeleton } from "@/components/customer-summary-skeleton";
import { CustomersHeader } from "@/components/customers-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import { InactiveClients } from "@/components/inactive-clients";
import { MostActiveClient } from "@/components/most-active-client";
import { NewCustomersThisMonth } from "@/components/new-customers-this-month";
import { ScrollableContent } from "@/components/scrollable-content";
import { DataTable } from "@/components/tables/customers/data-table";
import { CustomersSkeleton } from "@/components/tables/customers/skeleton";
import { TopRevenueClient } from "@/components/top-revenue-client";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import type { CustomersLoaderData } from "./customers";

export const Route = createLazyFileRoute("/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const loaderData = Route.useLoaderData() as CustomersLoaderData;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <ScrollableContent>
        <div className="flex flex-col gap-6">
          <CollapsibleSummary>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pt-6">
              <Suspense fallback={<CustomerSummarySkeleton />}>
                <MostActiveClient />
              </Suspense>
              <Suspense fallback={<CustomerSummarySkeleton />}>
                <InactiveClients />
              </Suspense>
              <Suspense fallback={<CustomerSummarySkeleton />}>
                <TopRevenueClient />
              </Suspense>
              <Suspense fallback={<CustomerSummarySkeleton />}>
                <NewCustomersThisMonth />
              </Suspense>
            </div>
          </CollapsibleSummary>

          <CustomersHeader />

          <ErrorBoundary errorComponent={ErrorFallback}>
            <Suspense fallback={<CustomersSkeleton />}>
              <DataTable initialSettings={loaderData.initialSettings} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </ScrollableContent>
    </AppLayoutShell>
  );
}
