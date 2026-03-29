import type { Metadata } from "next";
import { ErrorBoundary } from "next/dist/client/components/error-boundary";
import type { SearchParams } from "nuqs";
import { Suspense } from "react";
import { CollapsibleSummary } from "@/components/collapsible-summary";
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
import { loadInvoiceFilterParams } from "@/hooks/use-invoice-filter-params";
import { loadSortParams } from "@/hooks/use-sort-params";
import {
  getInvoiceListLocally,
  getInvoicePaymentStatusLocally,
  getInvoiceSummaryLocally,
} from "@/server/loaders/invoices";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { getInitialTableSettings } from "@/utils/columns";

export const metadata: Metadata = {
  title: "Invoices | Tamias",
};

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function Page(props: Props) {
  const queryClient = getQueryClient();
  const searchParams = await props.searchParams;

  const filter = loadInvoiceFilterParams(searchParams);
  const { sort } = loadSortParams(searchParams);

  // Get unified table settings from cookie
  const initialSettings = await getInitialTableSettings("invoices");

  const invoiceListQuery = trpc.invoice.get.infiniteQueryOptions(
    {
      ...filter,
      sort,
    },
    {
      getNextPageParam: ({ meta }) => meta?.cursor,
    },
  );
  const invoicesOpenSummaryQuery = trpc.invoice.invoiceSummary.queryOptions({
    statuses: ["draft", "scheduled", "unpaid"],
  });
  const invoicesPaidSummaryQuery = trpc.invoice.invoiceSummary.queryOptions({
    statuses: ["paid"],
  });
  const invoicesOverdueSummaryQuery = trpc.invoice.invoiceSummary.queryOptions({
    statuses: ["overdue"],
  });
  const invoicePaymentStatusQuery = trpc.invoice.paymentStatus.queryOptions();

  const [
    invoiceListResult,
    invoicesOpenSummaryResult,
    invoicesPaidSummaryResult,
    invoicesOverdueSummaryResult,
    invoicePaymentStatusResult,
  ] = await Promise.allSettled([
    getInvoiceListLocally({
      ...filter,
      sort,
    }),
    getInvoiceSummaryLocally(["draft", "scheduled", "unpaid"]),
    getInvoiceSummaryLocally(["paid"]),
    getInvoiceSummaryLocally(["overdue"]),
    getInvoicePaymentStatusLocally(),
  ]);

  if (invoiceListResult.status === "fulfilled") {
    queryClient.setQueryData(invoiceListQuery.queryKey, {
      pages: [invoiceListResult.value],
      pageParams: [null],
    });
  }

  if (invoicesOpenSummaryResult.status === "fulfilled") {
    queryClient.setQueryData(
      invoicesOpenSummaryQuery.queryKey,
      invoicesOpenSummaryResult.value,
    );
  }

  if (invoicesPaidSummaryResult.status === "fulfilled") {
    queryClient.setQueryData(
      invoicesPaidSummaryQuery.queryKey,
      invoicesPaidSummaryResult.value,
    );
  }

  if (invoicesOverdueSummaryResult.status === "fulfilled") {
    queryClient.setQueryData(
      invoicesOverdueSummaryQuery.queryKey,
      invoicesOverdueSummaryResult.value,
    );
  }

  if (invoicePaymentStatusResult.status === "fulfilled") {
    queryClient.setQueryData(
      invoicePaymentStatusQuery.queryKey,
      invoicePaymentStatusResult.value,
    );
  }

  return (
    <HydrateClient>
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
              <DataTable initialSettings={initialSettings} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </ScrollableContent>
    </HydrateClient>
  );
}
