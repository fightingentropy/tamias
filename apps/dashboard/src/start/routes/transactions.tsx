import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Suspense } from "react";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { buildHeadFromMetadata } from "@/start/site-head";
import { SiteLayoutShell } from "@/start/root-shell";
import { AddTransactions } from "@/components/add-transactions";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import { ScrollableContent } from "@/components/scrollable-content";
import { DataTable } from "@/components/tables/transactions/data-table";
import { Loading } from "@/components/tables/transactions/loading";
import { TransactionTabs } from "@/components/transaction-tabs";
import { TransactionsColumnVisibility } from "@/components/transactions-column-visibility";
import { TransactionsSearchFilter } from "@/components/transactions-search-filter";
import { TransactionsUploadZone } from "@/components/transactions-upload-zone";
import { Transactions as SiteTransactions } from "@/site/components/transactions";
import { transactionsSiteMetadata } from "@/site/pages/static-pages";

const loadTransactionsData = createServerFn({ method: "GET" })
  .inputValidator((data: { href: string }) => data)
  .handler(async ({ data }) => {
    const { buildTransactionsPageData } = await import("@/start/server/route-data");
    return (await buildTransactionsPageData(data.href)) as any;
  });

export const Route = createFileRoute("/transactions")({
  loader: ({ location }) =>
    loadTransactionsData({ data: { href: location.href } }),
  head: ({ loaderData }) =>
    loaderData?.mode === "site"
      ? buildHeadFromMetadata(transactionsSiteMetadata)
      : {
          meta: [{ title: "Transactions | Tamias" }],
        },
  component: TransactionsPage,
});

function TransactionsPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadTransactionsData>
  >;

  if (loaderData.mode === "site") {
    return (
      <SiteLayoutShell>
        <SiteTransactions />
      </SiteLayoutShell>
    );
  }

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <ScrollableContent>
        <div className="flex justify-between items-center py-6">
          <TransactionsSearchFilter />
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2">
              <TransactionsColumnVisibility />
              <AddTransactions />
            </div>
            <TransactionTabs />
          </div>
        </div>

        <ErrorBoundary errorComponent={ErrorFallback}>
          <Suspense
            fallback={
              <Loading
                columnVisibility={loaderData.initialSettings.columns}
                columnSizing={loaderData.initialSettings.sizing}
                columnOrder={loaderData.initialSettings.order}
              />
            }
          >
            <TransactionsUploadZone>
              <DataTable
                initialSettings={loaderData.initialSettings}
                initialTab={loaderData.initialTab}
              />
            </TransactionsUploadZone>
          </Suspense>
        </ErrorBoundary>
      </ScrollableContent>
    </AppLayoutShell>
  );
}
