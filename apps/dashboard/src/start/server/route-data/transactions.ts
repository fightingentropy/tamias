import { loadSortParams } from "@/hooks/use-sort-params";
import { loadTransactionFilterParams } from "@/hooks/use-transaction-filter-params";
import { loadTransactionTab } from "@/hooks/use-transaction-tab";
import { batchPrefetch, trpc } from "@/trpc/server";
import { getInitialTableSettings } from "@/utils/columns";
import { buildTransactionsQueryFilter } from "@/utils/transactions-query";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
  getCanonicalHostContext,
  getRequestUrl,
} from "@/start/server/route-data/shared";

export async function buildTransactionsPageData(href?: string) {
  if (getCanonicalHostContext().isWebsiteHost) {
    return {
      mode: "site" as const,
    };
  }

  const { queryClient, user } = await buildBaseAppShellState();
  const requestUrl = getRequestUrl(href);
  const filter = loadTransactionFilterParams(requestUrl.searchParams);
  const { sort } = loadSortParams(requestUrl.searchParams);
  const { tab } = loadTransactionTab(requestUrl.searchParams);
  const initialSettings = await getInitialTableSettings("transactions");
  const transactionsFilter = buildTransactionsQueryFilter({
    filter,
    sort,
    tab,
  });

  const activeTransactionsQuery = trpc.transactions.get.infiniteQueryOptions(
    transactionsFilter,
    {
      getNextPageParam: ({ meta }) => meta?.cursor,
    },
  );
  const reviewCountQuery = trpc.transactions.getReviewCount.queryOptions();
  const teamMembersQuery = trpc.team.members.queryOptions();
  const tagsQuery = trpc.tags.get.queryOptions();
  const appsQuery = trpc.apps.get.queryOptions();

  await batchPrefetch([
    activeTransactionsQuery,
    reviewCountQuery,
    teamMembersQuery,
    tagsQuery,
    appsQuery,
  ]);

  return {
    mode: "app" as const,
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    initialSettings,
    initialTab: tab,
  };
}

export async function buildTransactionCategoriesPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const categoriesQuery = trpc.transactionCategories.get.queryOptions();

  await batchPrefetch([categoriesQuery]);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
