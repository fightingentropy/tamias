import { loadCustomerFilterParams } from "@/hooks/use-customer-filter-params";
import { loadSortParams } from "@/hooks/use-sort-params";
import { batchPrefetch, trpc } from "@/trpc/server";
import { getInitialTableSettings } from "@/utils/columns";
import { buildCustomersQueryFilter } from "@/utils/customers-query";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
  getRequestUrl,
} from "@/start/server/route-data/shared";

export async function buildCustomersPageData(href?: string) {
  const { queryClient, user } = await buildBaseAppShellState();
  const requestUrl = getRequestUrl(href);
  const filter = loadCustomerFilterParams(requestUrl.searchParams);
  const { sort } = loadSortParams(requestUrl.searchParams);
  const initialSettings = await getInitialTableSettings("customers");
  const customersQueryFilter = buildCustomersQueryFilter({
    filter,
    sort,
  });
  const customersQuery = trpc.customers.get.infiniteQueryOptions(customersQueryFilter, {
    getNextPageParam: ({ meta }) => meta?.cursor,
  });
  const mostActiveClientQuery = trpc.invoice.mostActiveClient.queryOptions();
  const inactiveClientsCountQuery = trpc.invoice.inactiveClientsCount.queryOptions();
  const topRevenueClientQuery = trpc.invoice.topRevenueClient.queryOptions();
  const newCustomersCountQuery = trpc.invoice.newCustomersCount.queryOptions();

  await batchPrefetch([
    customersQuery,
    mostActiveClientQuery,
    inactiveClientsCountQuery,
    topRevenueClientQuery,
    newCustomersCountQuery,
  ]);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    initialSettings,
  };
}
