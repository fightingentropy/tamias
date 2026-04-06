import { createLazyFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
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
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import type { TransactionsLoaderData } from "./transactions";

export const Route = createLazyFileRoute("/transactions")({
  component: TransactionsPage,
});

function TransactionsPage() {
  const loaderData = Route.useLoaderData() as TransactionsLoaderData;

  return (
    <AppLayoutShell dehydratedState={loaderData.dehydratedState} user={loaderData.user}>
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
