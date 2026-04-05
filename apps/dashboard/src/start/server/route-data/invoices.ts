import { loadInvoiceFilterParams } from "@/hooks/use-invoice-filter-params";
import { loadSortParams } from "@/hooks/use-sort-params";
import { batchPrefetch, trpc } from "@/trpc/server";
import { getInitialTableSettings } from "@/utils/columns";
import { buildInvoicesQueryFilter } from "@/utils/invoices-query";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
  getRequestUrl,
} from "@/start/server/route-data/shared";

export async function buildInvoicesPageData(href?: string) {
  const { queryClient, user } = await buildBaseAppShellState();
  const requestUrl = getRequestUrl(href);
  const filter = loadInvoiceFilterParams(requestUrl.searchParams);
  const { sort } = loadSortParams(requestUrl.searchParams);
  const initialSettings = await getInitialTableSettings("invoices");
  const invoiceQueryFilter = buildInvoicesQueryFilter({
    filter,
    sort,
  });

  const invoiceListQuery = trpc.invoice.get.infiniteQueryOptions(
    invoiceQueryFilter,
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

  await batchPrefetch([
    invoiceListQuery,
    invoicesOpenSummaryQuery,
    invoicesPaidSummaryQuery,
    invoicesOverdueSummaryQuery,
    invoicePaymentStatusQuery,
  ]);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    initialSettings,
  };
}

export async function buildInvoiceProductsPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const productsQuery = trpc.invoiceProducts.get.queryOptions({
    sortBy: "recent",
    limit: 100,
    includeInactive: true,
  });

  await batchPrefetch([productsQuery]);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
