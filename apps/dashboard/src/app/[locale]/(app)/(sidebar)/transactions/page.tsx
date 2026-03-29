import type { Metadata } from "next";
import { ErrorBoundary } from "next/dist/client/components/error-boundary";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";
import { AddTransactions } from "@/components/add-transactions";
import { ErrorFallback } from "@/components/error-fallback";
import { ScrollableContent } from "@/components/scrollable-content";
import { DataTable } from "@/components/tables/transactions/data-table";
import { Loading } from "@/components/tables/transactions/loading";
import { TransactionTabs } from "@/components/transaction-tabs";
import { TransactionsColumnVisibility } from "@/components/transactions-column-visibility";
import { TransactionsSearchFilter } from "@/components/transactions-search-filter";
import { TransactionsUploadZone } from "@/components/transactions-upload-zone";
import { loadSortParams } from "@/hooks/use-sort-params";
import { loadTransactionFilterParams } from "@/hooks/use-transaction-filter-params";
import { loadTransactionTab } from "@/hooks/use-transaction-tab";
import { getInstalledAppsLocally } from "@/server/loaders/apps";
import { getCurrentTeamMembersLocally } from "@/server/loaders/identity";
import { getCurrentTeamTagsLocally } from "@/server/loaders/tags";
import {
  getTransactionsLocally,
  getTransactionsReviewCountLocally,
} from "@/server/loaders/transactions";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { getInitialTableSettings } from "@/utils/columns";

export const metadata: Metadata = {
  title: "Transactions | Tamias",
};

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function Transactions(props: Props) {
  const queryClient = getQueryClient();
  const searchParams = await props.searchParams;

  const filter = loadTransactionFilterParams(searchParams);
  const { sort } = loadSortParams(searchParams);
  const { tab } = loadTransactionTab(searchParams);
  const isReviewTab = tab === "review";

  // Get unified table settings from cookie
  const initialSettings = await getInitialTableSettings("transactions");

  // Build query filters for both tabs
  const allTabFilter = {
    ...filter,
    amountRange: filter.amount_range ?? null,
    sort,
  };

  const reviewTabFilter = {
    // Review is a strict queue and does not apply user filters.
    sort,
    fulfilled: true,
    exported: false,
  };

  const allTransactionsQuery = trpc.transactions.get.infiniteQueryOptions(
    allTabFilter,
    {
      getNextPageParam: ({ meta }) => meta?.cursor,
    },
  );
  const reviewTransactionsQuery = trpc.transactions.get.infiniteQueryOptions(
    reviewTabFilter,
    {
      getNextPageParam: ({ meta }) => meta?.cursor,
    },
  );
  const activeTransactionsQuery = isReviewTab
    ? reviewTransactionsQuery
    : allTransactionsQuery;
  const reviewCountQuery = trpc.transactions.getReviewCount.queryOptions();
  const teamMembersQuery = trpc.team.members.queryOptions();
  const tagsQuery = trpc.tags.get.queryOptions();
  const appsQuery = trpc.apps.get.queryOptions();

  const [
    activeTransactionsResult,
    reviewCountResult,
    teamMembersResult,
    tagsResult,
    appsResult,
  ] = await Promise.allSettled([
    getTransactionsLocally(isReviewTab ? reviewTabFilter : allTabFilter),
    getTransactionsReviewCountLocally(),
    getCurrentTeamMembersLocally(),
    getCurrentTeamTagsLocally(),
    getInstalledAppsLocally(),
  ]);

  if (activeTransactionsResult.status === "fulfilled") {
    queryClient.setQueryData(activeTransactionsQuery.queryKey, {
      pages: [activeTransactionsResult.value],
      pageParams: [null],
    });
  }

  if (reviewCountResult.status === "fulfilled") {
    queryClient.setQueryData(
      reviewCountQuery.queryKey,
      reviewCountResult.value,
    );
  }

  if (teamMembersResult.status === "fulfilled") {
    queryClient.setQueryData(
      teamMembersQuery.queryKey,
      teamMembersResult.value,
    );
  }

  if (tagsResult.status === "fulfilled") {
    queryClient.setQueryData(tagsQuery.queryKey, tagsResult.value);
  }

  if (appsResult.status === "fulfilled") {
    queryClient.setQueryData(appsQuery.queryKey, appsResult.value);
  }

  return (
    <HydrateClient>
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
                columnVisibility={initialSettings.columns}
                columnSizing={initialSettings.sizing}
                columnOrder={initialSettings.order}
              />
            }
          >
            <TransactionsUploadZone>
              <DataTable initialSettings={initialSettings} initialTab={tab} />
            </TransactionsUploadZone>
          </Suspense>
        </ErrorBoundary>
      </ScrollableContent>
    </HydrateClient>
  );
}
