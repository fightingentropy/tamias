import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Suspense } from "react";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { CollapsibleSummary } from "@/components/collapsible-summary";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import { InvoiceHeader } from "@/components/invoice-header";
import {
  InvoicePaymentScore,
  InvoicePaymentScoreSkeleton,
} from "@/components/invoice-payment-score";
import { InvoiceSummarySkeleton } from "@/components/invoice-summary";
import { InvoicesOpen } from "@/components/invoices-open";
import { InvoicesOverdue } from "@/components/invoices-overdue";
import { InvoicesPaid } from "@/components/invoices-paid";
import { ScrollableContent } from "@/components/scrollable-content";
import { DataTable } from "@/components/tables/invoices/data-table";
import { InvoiceSkeleton } from "@/components/tables/invoices/skeleton";

const loadInvoicesData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildInvoicesPageData } = await import("@/start/server/route-data");
    return (await buildInvoicesPageData(data.href)) as any;
  });

export const Route = createFileRoute("/invoices")({
  loader: ({ location }) => loadInvoicesData({ data: { href: location.href } }),
  head: () => ({
    meta: [{ title: "Invoices | Tamias" }],
  }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadInvoicesData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <ScrollableContent>
        <div className="flex flex-col gap-6">
          <CollapsibleSummary>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pt-6">
              <Suspense fallback={<InvoiceSummarySkeleton />}>
                <InvoicesOpen />
              </Suspense>
              <Suspense fallback={<InvoiceSummarySkeleton />}>
                <InvoicesOverdue />
              </Suspense>
              <Suspense fallback={<InvoiceSummarySkeleton />}>
                <InvoicesPaid />
              </Suspense>
              <Suspense fallback={<InvoicePaymentScoreSkeleton />}>
                <InvoicePaymentScore />
              </Suspense>
            </div>
          </CollapsibleSummary>

          <InvoiceHeader />

          <ErrorBoundary errorComponent={ErrorFallback}>
            <Suspense fallback={<InvoiceSkeleton />}>
              <DataTable initialSettings={loaderData.initialSettings} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </ScrollableContent>
    </AppLayoutShell>
  );
}
