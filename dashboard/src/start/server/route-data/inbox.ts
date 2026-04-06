import { loadInboxFilterParams } from "@/hooks/use-inbox-filter-params";
import { loadInboxParams } from "@/hooks/use-inbox-params";
import { trpc } from "@/trpc/server";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
  getRequestUrl,
} from "./shared";

export async function buildInboxPageData(href?: string) {
  const { queryClient, user } = await buildBaseAppShellState();
  const requestUrl = getRequestUrl(href);
  const filter = loadInboxFilterParams(requestUrl.searchParams);
  const params = loadInboxParams(requestUrl.searchParams);
  const inboxQuery = trpc.inbox.get.infiniteQueryOptions(
    {
      order: params.order,
      sort: params.sort,
      ...filter,
      tab: filter.tab ?? "all",
    },
    {
      getNextPageParam: ({ meta }) => meta?.cursor,
    },
  );
  const inboxAccountsQuery = trpc.inboxAccounts.get.queryOptions();
  const selectedInboxQuery = params.inboxId
    ? trpc.inbox.getById.queryOptions({ id: params.inboxId })
    : null;

  const [inboxPageResult, accountsResult] = await Promise.allSettled([
    queryClient.fetchInfiniteQuery(inboxQuery as any),
    queryClient.fetchQuery(inboxAccountsQuery),
    params.inboxId
      ? queryClient.fetchQuery(selectedInboxQuery!)
      : Promise.resolve(null),
  ]);

  const inboxPage =
    inboxPageResult.status === "fulfilled"
      ? ((inboxPageResult.value.pages[0] as { data: unknown[] } | undefined) ??
        null)
      : null;
  const accounts =
    accountsResult.status === "fulfilled" ? accountsResult.value : null;

  const hasInboxItems = (inboxPage?.data.length ?? 0) > 0;
  const hasConnectedAccounts = (accounts?.length ?? 0) > 0;
  const hasFilter = Object.entries(filter).some(
    ([key, value]) => key !== "tab" && value !== null,
  );
  const isAllTab = !filter.tab || filter.tab === "all";
  const hasSyncedAccounts =
    accounts?.some((account) => account.lastAccessed !== null) ?? false;
  const view =
    !hasConnectedAccounts && !hasInboxItems && !hasFilter
      ? "get-started"
      : isAllTab &&
          hasConnectedAccounts &&
          hasSyncedAccounts &&
          !hasInboxItems &&
          !hasFilter &&
          !params.connected
        ? "connected-empty"
        : "list";

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    view,
  };
}

export async function buildInboxSettingsPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const inboxAccountsQuery = trpc.inboxAccounts.get.queryOptions();
  const inboxBlocklistQuery = trpc.inbox.blocklist.get.queryOptions();
  await Promise.all([
    queryClient.fetchQuery(inboxAccountsQuery),
    queryClient.fetchQuery(inboxBlocklistQuery),
  ]);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
