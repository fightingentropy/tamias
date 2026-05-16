import { createLazyFileRoute } from "@tanstack/react-router";
import { CollapsibleSummary } from "@/components/collapsible-summary";
import { CustomerSummarySkeleton } from "@/components/customer-summary-skeleton";
import { CustomersHeader } from "@/components/customers-header";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import { ScrollableContent } from "@/components/scrollable-content";
import { CustomersSkeleton } from "@/components/tables/customers/skeleton";
import dynamic from "@/framework/dynamic";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import type { CustomersLoaderData } from "./customers";

const MostActiveClient = dynamic(
  () => import("@/components/most-active-client").then((mod) => mod.MostActiveClient),
  { ssr: false, loading: CustomerSummarySkeleton },
);
const InactiveClients = dynamic(
  () => import("@/components/inactive-clients").then((mod) => mod.InactiveClients),
  { ssr: false, loading: CustomerSummarySkeleton },
);
const TopRevenueClient = dynamic(
  () => import("@/components/top-revenue-client").then((mod) => mod.TopRevenueClient),
  { ssr: false, loading: CustomerSummarySkeleton },
);
const NewCustomersThisMonth = dynamic(
  () => import("@/components/new-customers-this-month").then((mod) => mod.NewCustomersThisMonth),
  { ssr: false, loading: CustomerSummarySkeleton },
);
const DataTable = dynamic(
  () => import("@/components/tables/customers/data-table").then((mod) => mod.DataTable),
  { ssr: false, loading: CustomersSkeleton },
);

export const Route = createLazyFileRoute("/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const loaderData = Route.useLoaderData() as CustomersLoaderData;

  return (
    <AppLayoutShell dehydratedState={loaderData.dehydratedState} user={loaderData.user}>
      <ScrollableContent>
        <div className="flex flex-col gap-6">
          <CollapsibleSummary>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pt-6">
              <MostActiveClient />
              <InactiveClients />
              <TopRevenueClient />
              <NewCustomersThisMonth />
            </div>
          </CollapsibleSummary>

          <CustomersHeader />

          <ErrorBoundary errorComponent={ErrorFallback}>
            <DataTable initialSettings={loaderData.initialSettings} />
          </ErrorBoundary>
        </div>
      </ScrollableContent>
    </AppLayoutShell>
  );
}
