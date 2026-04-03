import { loadInboxFilterParams } from "@/hooks/use-inbox-filter-params";
import { loadInboxParams } from "@/hooks/use-inbox-params";
import {
  getInboxAccountsLocally,
  getInboxBlocklistLocally,
  getInboxItemLocally,
  getInboxLocally,
} from "@/server/loaders/inbox";
import { trpc } from "@/trpc/server";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
  getCanonicalHostContext,
  getRequestUrl,
} from "./shared";

export async function buildInboxPageData(href?: string) {
  if (getCanonicalHostContext().isWebsiteHost) {
    return {
      mode: "site" as const,
    };
  }

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

  const [inboxPageResult, accountsResult, selectedInboxResult] =
    await Promise.allSettled([
      getInboxLocally({
        order: params.order,
        sort: params.sort,
        ...filter,
        tab: filter.tab ?? "all",
      }),
      getInboxAccountsLocally(),
      params.inboxId
        ? getInboxItemLocally(params.inboxId)
        : Promise.resolve(null),
    ]);

  const inboxPage =
    inboxPageResult.status === "fulfilled" ? inboxPageResult.value : null;
  const accounts =
    accountsResult.status === "fulfilled" ? accountsResult.value : null;

  if (inboxPage) {
    queryClient.setQueryData(inboxQuery.queryKey, {
      pages: [inboxPage],
      pageParams: [null],
    });
  }

  if (accounts) {
    queryClient.setQueryData(inboxAccountsQuery.queryKey, accounts);
  }

  if (selectedInboxQuery && selectedInboxResult.status === "fulfilled") {
    queryClient.setQueryData(
      selectedInboxQuery.queryKey,
      selectedInboxResult.value,
    );
  }

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
    mode: "app" as const,
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    view,
  };
}

export async function buildInboxSettingsPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const inboxAccountsQuery = trpc.inboxAccounts.get.queryOptions();
  const inboxBlocklistQuery = trpc.inbox.blocklist.get.queryOptions();
  const [inboxAccounts, blocklist] = await Promise.all([
    getInboxAccountsLocally(),
    getInboxBlocklistLocally(),
  ]);

  queryClient.setQueryData(inboxAccountsQuery.queryKey, inboxAccounts);
  queryClient.setQueryData(inboxBlocklistQuery.queryKey, blocklist);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}
