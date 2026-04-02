
import { decrypt } from "@tamias/encryption";
import { getCountryCode, getCurrency } from "@tamias/location/server";
import { getConvexUrl } from "@tamias/utils/envs";
import { isOverviewWidgetType } from "@tamias/app-services/widgets";
import { dehydrate } from "@tanstack/react-query";
import { notFound, redirect } from "@tanstack/react-router";
import { getStartContext } from "@tanstack/start-storage-context";
import { format, parseISO } from "date-fns";
import { cookies } from "@tamias/utils/request-runtime";
import { getChartDisplayName } from "@/components/metrics/utils/chart-types";
import { loadCustomerFilterParams } from "@/hooks/use-customer-filter-params";
import { loadDocumentFilterParams } from "@/hooks/use-document-filter-params";
import { loadInboxFilterParams } from "@/hooks/use-inbox-filter-params";
import { loadInboxParams } from "@/hooks/use-inbox-params";
import { loadInvoiceFilterParams } from "@/hooks/use-invoice-filter-params";
import { loadOAuthParams } from "@/hooks/use-oauth-params";
import { loadSortParams } from "@/hooks/use-sort-params";
import { loadTrackerFilterParams } from "@/hooks/use-tracker-filter-params";
import { loadTransactionFilterParams } from "@/hooks/use-transaction-filter-params";
import { loadTransactionTab } from "@/hooks/use-transaction-tab";
import {
  getApiKeysLocally,
  getAuthorizedOAuthApplicationsLocally,
  getInstalledAppsLocally,
  getOAuthApplicationInfoLocally,
  getOAuthApplicationsLocally,
  getStripeStatusLocally,
} from "@/server/loaders/apps";
import {
  getBankAccountsLocally,
  getBankConnectionsLocally,
} from "@/server/loaders/bank";
import {
  getActiveSubscriptionLocally,
  getBillingOrdersLocally,
} from "@/server/loaders/billing";
import { getChatMessagesLocally } from "@/server/loaders/chat";
import {
  getComplianceProfileLocally,
  getPayrollDashboardLocally,
  getVatDashboardLocally,
  getVatSubmissionsLocally,
  getYearEndDashboardLocally,
} from "@/server/loaders/compliance";
import {
  getCustomersLocally,
  getInactiveClientsCountLocally,
  getMostActiveClientLocally,
  getNewCustomersCountLocally,
  getTopRevenueClientLocally,
} from "@/server/loaders/customers";
import { getDocumentsLocally } from "@/server/loaders/documents";
import {
  getCurrentTeamLocally,
  getCurrentTeamInvitesLocally,
  getCurrentTeamMembersLocally,
  getCurrentUserLocally,
  getCurrentUserInvitesLocally,
  getCurrentUserTeamsLocally,
  getTeamInvitesByEmailLocally,
} from "@/server/loaders/identity";
import {
  getInboxAccountsLocally,
  getInboxBlocklistLocally,
  getInboxLocally,
} from "@/server/loaders/inbox";
import {
  getCustomerPortalDataLocally,
  getCustomerPortalInvoicesLocally,
  getInvoiceByTokenLocally,
  getReportByLinkIdLocally,
  getReportChartDataByLinkIdLocally,
  getShortLinkLocally,
} from "@/server/loaders/public";
import {
  getCurrentWidgetPreferencesLocally,
  getOverviewWidgetsLocally,
} from "@/server/loaders/widgets";
import {
  getInvoiceListLocally,
  getInvoicePaymentStatusLocally,
  getInvoiceSummaryLocally,
} from "@/server/loaders/invoices";
import { getInvoiceProductsLocally } from "@/server/loaders/invoice-products";
import {
  getTransactionCategoriesLocally,
  getTransactionsLocally,
  getTransactionsReviewCountLocally,
} from "@/server/loaders/transactions";
import { getCurrentTeamTagsLocally } from "@/server/loaders/tags";
import { getTrackerProjectsLocally } from "@/server/loaders/tracker";
import { getInitialMetricsFilter } from "@/server/loaders/metrics";
import { getQueryClient, getTRPCClient, trpc } from "@/trpc/server";
import { getInitialTableSettings } from "@/utils/columns";
import { Cookies } from "@/utils/constants";
import { geolocation } from "@/utils/geo";
import { categorizeOAuthError, validateOAuthParams } from "@/utils/oauth-utils";
import { getConvexAuthToken } from "@/start/auth/server";

function getRequestUrl(input?: string) {
  if (input) {
    return new URL(input, "http://localhost");
  }

  return new URL(getStartContext().request.url);
}

function getCanonicalHostContext() {
  const startContext = getStartContext();
  const requestUrl = new URL(startContext.request.url);
  const canonicalHost = startContext.contextAfterGlobalMiddlewares
    ?.canonicalHost as
    | {
        appHost: string;
        websiteHost: string;
        currentHost: string;
        isAppHost: boolean;
        isWebsiteHost: boolean;
      }
    | undefined;
  const currentHost = startContext.request.headers.get("host") ?? requestUrl.host;
  const appHost = canonicalHost?.appHost ?? currentHost;
  const websiteHost = canonicalHost?.websiteHost ?? currentHost;

  return {
    appHost,
    websiteHost,
    currentHost,
    isAppHost: canonicalHost?.isAppHost ?? true,
    isWebsiteHost: canonicalHost?.isWebsiteHost ?? false,
  };
}

function dehydrateQueryClient(queryClient: ReturnType<typeof getQueryClient>) {
  return dehydrate(queryClient) as unknown as Record<string, {}>;
}

function isLocalPublicReadUnavailable(error: unknown) {
  const convexUrl = getConvexUrl();
  const isLocalConvexUrl =
    convexUrl.includes("127.0.0.1:3210") || convexUrl.includes("localhost:3210");

  if (!isLocalConvexUrl || !error || typeof error !== "object") {
    return false;
  }

  if (error instanceof Error && error.message === "Network connection lost.") {
    return true;
  }

  const cause = "cause" in error ? (error as { cause?: unknown }).cause : null;

  if (!cause || typeof cause !== "object") {
    return false;
  }

  const networkError = cause as {
    code?: unknown;
    address?: unknown;
    port?: unknown;
  };

  return (
    networkError.code === "ECONNREFUSED" &&
    networkError.address === "127.0.0.1" &&
    networkError.port === 3210
  );
}

async function buildBaseAppShellState(opts?: { allowIncomplete?: boolean }) {
  const queryClient = getQueryClient();
  const [team, user] = await Promise.all([
    getCurrentTeamLocally(),
    getCurrentUserLocally(),
  ]);

  if (!user) {
    throw redirect({
      to: "/login",
      throw: true,
    });
  }

  queryClient.setQueryData(trpc.team.current.queryKey(), team);
  queryClient.setQueryData(trpc.user.me.queryKey(), user);

  if (!opts?.allowIncomplete && (!user.fullName || !user.teamId)) {
    throw redirect({
      to: "/onboarding",
      throw: true,
    });
  }

  return {
    queryClient,
    user,
    team,
  };
}

async function buildShellOnlyPageData(opts?: { allowIncomplete?: boolean }) {
  const { queryClient, user } = await buildBaseAppShellState(opts);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function getRootBootstrapData() {
  const startContext = getStartContext();
  const auth = startContext.contextAfterGlobalMiddlewares?.auth as
    | {
        token?: string | null;
        refreshToken?: string | null;
      }
    | undefined;

  return {
    auth: {
      token: auth?.token ?? null,
      refreshToken: auth?.refreshToken ?? null,
    },
    host: getCanonicalHostContext(),
  };
}

export async function resolveIndexRoute() {
  const auth = startContextAuth();
  const host = getCanonicalHostContext();

  if (host.isAppHost) {
    throw redirect({
      to: auth.token ? "/dashboard" : "/login",
      throw: true,
    });
  }

  return {
    host,
  };
}

function startContextAuth() {
  const startContext = getStartContext();

  return (startContext.contextAfterGlobalMiddlewares?.auth ?? {
    token: null,
    refreshToken: null,
  }) as {
    token: string | null;
    refreshToken: string | null;
  };
}

export async function buildDashboardPageData(href?: string) {
  const { queryClient, user, team } = await buildBaseAppShellState();
  const requestUrl = getRequestUrl(href);
  const widgetPreferences = await getCurrentWidgetPreferencesLocally();
  const metricsFilter = getInitialMetricsFilter(
    Object.fromEntries(requestUrl.searchParams.entries()),
    team?.fiscalYearStartMonth,
  );
  const overviewWidgets =
    widgetPreferences.primaryWidgets.filter(isOverviewWidgetType);
  const shouldHydrateOverview =
    metricsFilter.tab !== "metrics" && overviewWidgets.length > 0;
  const overviewData = shouldHydrateOverview
    ? await getOverviewWidgetsLocally(
        overviewWidgets.join(","),
        metricsFilter.from,
        metricsFilter.to,
        metricsFilter.currency,
        metricsFilter.revenueType,
      )
    : null;

  queryClient.setQueryData(
    trpc.widgets.getWidgetPreferences.queryKey(),
    widgetPreferences,
  );

  if (overviewData) {
    const overviewQuery = trpc.widgets.getOverview.queryOptions({
      widgets: overviewWidgets,
      from: metricsFilter.from,
      to: metricsFilter.to,
      currency: metricsFilter.currency,
      revenueType: metricsFilter.revenueType,
    });

    queryClient.setQueryData(overviewQuery.queryKey, overviewData);
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    initialPreferences: widgetPreferences,
    geo: geolocation(getStartContext().request.headers as Headers),
  };
}

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
  const isReviewTab = tab === "review";
  const initialSettings = await getInitialTableSettings("transactions");

  const allTabFilter = {
    ...filter,
    amountRange: filter.amount_range ?? null,
    sort,
  };
  const reviewTabFilter = {
    sort,
    fulfilled: true,
    exported: false,
  };

  const activeTransactionsQuery = isReviewTab
    ? trpc.transactions.get.infiniteQueryOptions(reviewTabFilter, {
        getNextPageParam: ({ meta }) => meta?.cursor,
      })
    : trpc.transactions.get.infiniteQueryOptions(allTabFilter, {
        getNextPageParam: ({ meta }) => meta?.cursor,
      });
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

  return {
    mode: "app" as const,
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    initialSettings,
    initialTab: tab,
  };
}

export async function buildInvoicesPageData(href?: string) {
  const { queryClient, user } = await buildBaseAppShellState();
  const requestUrl = getRequestUrl(href);
  const filter = loadInvoiceFilterParams(requestUrl.searchParams);
  const { sort } = loadSortParams(requestUrl.searchParams);
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
  const productsResult = await getInvoiceProductsLocally({
    sortBy: "recent",
    limit: 100,
    includeInactive: true,
  }).catch(() => null);

  if (productsResult) {
    queryClient.setQueryData(productsQuery.queryKey, productsResult);
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildAppsPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const installedAppsQuery = trpc.apps.get.queryOptions();
  const oauthApplicationsQuery = trpc.oauthApplications.list.queryOptions();
  const authorizedApplicationsQuery =
    trpc.oauthApplications.authorized.queryOptions();
  const inboxAccountsQuery = trpc.inboxAccounts.get.queryOptions();
  const stripeStatusQuery = trpc.invoicePayments.stripeStatus.queryOptions();

  const [
    installedAppsResult,
    oauthApplicationsResult,
    authorizedApplicationsResult,
    inboxAccountsResult,
    stripeStatusResult,
  ] = await Promise.allSettled([
    getInstalledAppsLocally(),
    getOAuthApplicationsLocally(),
    getAuthorizedOAuthApplicationsLocally(),
    getInboxAccountsLocally(),
    getStripeStatusLocally(),
  ]);

  if (installedAppsResult.status === "fulfilled") {
    queryClient.setQueryData(
      installedAppsQuery.queryKey,
      installedAppsResult.value,
    );
  }

  if (oauthApplicationsResult.status === "fulfilled") {
    queryClient.setQueryData(
      oauthApplicationsQuery.queryKey,
      oauthApplicationsResult.value,
    );
  }

  if (authorizedApplicationsResult.status === "fulfilled") {
    queryClient.setQueryData(
      authorizedApplicationsQuery.queryKey,
      authorizedApplicationsResult.value,
    );
  }

  if (inboxAccountsResult.status === "fulfilled") {
    queryClient.setQueryData(
      inboxAccountsQuery.queryKey,
      inboxAccountsResult.value,
    );
  }

  if (stripeStatusResult.status === "fulfilled") {
    queryClient.setQueryData(
      stripeStatusQuery.queryKey,
      stripeStatusResult.value,
    );
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildCustomersPageData(href?: string) {
  if (getCanonicalHostContext().isWebsiteHost) {
    return {
      mode: "site" as const,
    };
  }

  const { queryClient, user } = await buildBaseAppShellState();
  const requestUrl = getRequestUrl(href);
  const filter = loadCustomerFilterParams(requestUrl.searchParams);
  const { sort } = loadSortParams(requestUrl.searchParams);
  const initialSettings = await getInitialTableSettings("customers");
  const customersQuery = trpc.customers.get.infiniteQueryOptions(
    {
      ...filter,
      sort,
    },
    {
      getNextPageParam: ({ meta }) => meta?.cursor,
    },
  );
  const mostActiveClientQuery = trpc.invoice.mostActiveClient.queryOptions();
  const inactiveClientsCountQuery =
    trpc.invoice.inactiveClientsCount.queryOptions();
  const topRevenueClientQuery = trpc.invoice.topRevenueClient.queryOptions();
  const newCustomersCountQuery = trpc.invoice.newCustomersCount.queryOptions();

  const [
    customersResult,
    mostActiveClientResult,
    inactiveClientsCountResult,
    topRevenueClientResult,
    newCustomersCountResult,
  ] = await Promise.allSettled([
    getCustomersLocally({
      q: filter.q,
      sort,
    }),
    getMostActiveClientLocally(),
    getInactiveClientsCountLocally(),
    getTopRevenueClientLocally(),
    getNewCustomersCountLocally(),
  ]);

  if (customersResult.status === "fulfilled") {
    queryClient.setQueryData(customersQuery.queryKey, {
      pages: [customersResult.value],
      pageParams: [null],
    });
  }

  if (mostActiveClientResult.status === "fulfilled") {
    queryClient.setQueryData(
      mostActiveClientQuery.queryKey,
      mostActiveClientResult.value,
    );
  }

  if (inactiveClientsCountResult.status === "fulfilled") {
    queryClient.setQueryData(
      inactiveClientsCountQuery.queryKey,
      inactiveClientsCountResult.value,
    );
  }

  if (topRevenueClientResult.status === "fulfilled") {
    queryClient.setQueryData(
      topRevenueClientQuery.queryKey,
      topRevenueClientResult.value,
    );
  }

  if (newCustomersCountResult.status === "fulfilled") {
    queryClient.setQueryData(
      newCustomersCountQuery.queryKey,
      newCustomersCountResult.value,
    );
  }

  return {
    mode: "app" as const,
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    initialSettings,
  };
}

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

  const [inboxPageResult, accountsResult] = await Promise.allSettled([
    getInboxLocally({
      order: params.order,
      sort: params.sort,
      ...filter,
      tab: filter.tab ?? "all",
    }),
    getInboxAccountsLocally(),
  ]);

  const inboxPage =
    inboxPageResult.status === "fulfilled" ? inboxPageResult.value : null;
  const accounts = accountsResult.status === "fulfilled" ? accountsResult.value : null;

  if (inboxPage) {
    queryClient.setQueryData(inboxQuery.queryKey, {
      pages: [inboxPage],
      pageParams: [null],
    });
  }

  if (accounts) {
    queryClient.setQueryData(inboxAccountsQuery.queryKey, accounts);
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

export async function buildTransactionCategoriesPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const categoriesQuery = trpc.transactionCategories.get.queryOptions();
  const categoriesResult = await getTransactionCategoriesLocally().catch(
    () => null,
  );

  if (categoriesResult) {
    queryClient.setQueryData(categoriesQuery.queryKey, categoriesResult);
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildAccountPageData() {
  return buildShellOnlyPageData();
}

export async function buildAccountDateAndLocalePageData() {
  return buildShellOnlyPageData();
}

export async function buildAccountSecurityPageData() {
  return buildShellOnlyPageData();
}

export async function buildAccountSupportPageData() {
  return buildShellOnlyPageData();
}

export async function buildAccountTeamsPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const [teams, invites] = await Promise.all([
    getCurrentUserTeamsLocally(),
    getCurrentUserInvitesLocally(),
  ]);

  queryClient.setQueryData(trpc.team.list.queryKey(), teams);
  queryClient.setQueryData(trpc.user.invites.queryKey(), invites);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildSettingsPageData() {
  return buildShellOnlyPageData();
}

export async function buildSettingsAccountsPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const bankConnectionsQuery = trpc.bankConnections.get.queryOptions();
  const manualBankAccountsQuery = trpc.bankAccounts.get.queryOptions({
    manual: true,
  });
  const [connections, manualAccounts] = await Promise.all([
    getBankConnectionsLocally(),
    getBankAccountsLocally({ manual: true }),
  ]);

  queryClient.setQueryData(bankConnectionsQuery.queryKey, connections);
  queryClient.setQueryData(manualBankAccountsQuery.queryKey, manualAccounts);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildSettingsBillingPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const team = user.team;
  const shouldShowSubscription = Boolean(team && team.plan !== "trial");
  const shouldShowOrders = Boolean(
    team && (team.plan !== "trial" || team.canceledAt !== null),
  );
  const ordersQuery = trpc.billing.orders.infiniteQueryOptions(
    {
      pageSize: 15,
    },
    {
      getNextPageParam: ({ meta }) => meta?.cursor,
    },
  );
  const activeSubscriptionQuery =
    trpc.billing.getActiveSubscription.queryOptions();

  const [orders, activeSubscription] = await Promise.all([
    shouldShowOrders ? getBillingOrdersLocally(undefined, 15) : null,
    shouldShowSubscription ? getActiveSubscriptionLocally() : null,
  ]);

  if (orders) {
    queryClient.setQueryData(ordersQuery.queryKey, {
      pages: [orders],
      pageParams: [null],
    });
  }

  if (shouldShowSubscription) {
    queryClient.setQueryData(
      activeSubscriptionQuery.queryKey,
      activeSubscription,
    );
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildSettingsDeveloperPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const apiKeysQuery = trpc.apiKeys.get.queryOptions();
  const oauthApplicationsQuery = trpc.oauthApplications.list.queryOptions();
  const [apiKeysResult, oauthApplicationsResult] = await Promise.allSettled([
    getApiKeysLocally(),
    getOAuthApplicationsLocally(),
  ]);

  if (apiKeysResult.status === "fulfilled") {
    queryClient.setQueryData(apiKeysQuery.queryKey, apiKeysResult.value);
  }

  if (oauthApplicationsResult.status === "fulfilled") {
    queryClient.setQueryData(
      oauthApplicationsQuery.queryKey,
      oauthApplicationsResult.value,
    );
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildSettingsMembersPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const [members, invites] = await Promise.all([
    getCurrentTeamMembersLocally(),
    getCurrentTeamInvitesLocally(),
  ]);

  queryClient.setQueryData(trpc.team.members.queryKey(), members);
  queryClient.setQueryData(trpc.team.teamInvites.queryKey(), invites);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildSettingsNotificationsPageData() {
  return buildShellOnlyPageData();
}

export async function buildCompliancePageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const vatDashboardQuery = trpc.vat.getDashboard.queryOptions();
  const vatDashboardResult = await getVatDashboardLocally().catch(() => null);

  if (vatDashboardResult) {
    queryClient.setQueryData(vatDashboardQuery.queryKey, vatDashboardResult);
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildCompliancePayrollPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const dashboard = await getPayrollDashboardLocally().catch(() => null);

  if (dashboard) {
    queryClient.setQueryData(trpc.payroll.getDashboard.queryKey(), dashboard);
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildComplianceSettingsPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const profile = await getComplianceProfileLocally();

  queryClient.setQueryData(trpc.compliance.getProfile.queryKey(), profile);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildComplianceVatPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const vatDashboardQuery = trpc.vat.getDashboard.queryOptions();
  const vatSubmissionsQuery = trpc.vat.listSubmissions.queryOptions();
  const [vatDashboardResult, vatSubmissionsResult] = await Promise.allSettled([
    getVatDashboardLocally(),
    getVatSubmissionsLocally(),
  ]);

  if (vatDashboardResult.status === "fulfilled") {
    queryClient.setQueryData(
      vatDashboardQuery.queryKey,
      vatDashboardResult.value,
    );
  }

  if (vatSubmissionsResult.status === "fulfilled") {
    queryClient.setQueryData(
      vatSubmissionsQuery.queryKey,
      vatSubmissionsResult.value,
    );
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildComplianceYearEndPageData() {
  const { queryClient, user } = await buildBaseAppShellState();
  const dashboard = await getYearEndDashboardLocally().catch(() => null);

  if (dashboard) {
    queryClient.setQueryData(trpc.yearEnd.getDashboard.queryKey(), dashboard);
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
}

export async function buildVaultPageData(href?: string) {
  const { queryClient, user } = await buildBaseAppShellState();
  const requestUrl = getRequestUrl(href);
  const filter = loadDocumentFilterParams(requestUrl.searchParams);
  const initialSettings = await getInitialTableSettings("vault");
  const documentsQuery = trpc.documents.get.infiniteQueryOptions(
    {
      ...filter,
      pageSize: 24,
    },
    {
      getNextPageParam: ({ meta }) => meta?.cursor,
    },
  );
  const documentsResult = await getDocumentsLocally({
    ...filter,
    pageSize: 24,
  }).catch(() => null);

  if (documentsResult) {
    queryClient.setQueryData(documentsQuery.queryKey, {
      pages: [documentsResult],
      pageParams: [null],
    });
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    initialSettings,
  };
}

export async function buildTrackerPageData(href?: string) {
  const { queryClient, user } = await buildBaseAppShellState();
  const requestUrl = getRequestUrl(href);
  const filter = loadTrackerFilterParams(requestUrl.searchParams);
  const { sort } = loadSortParams(requestUrl.searchParams);
  const weeklyCalendar =
    (await cookies()).get(Cookies.WeeklyCalendar)?.value === "true";
  const trackerProjectsQuery = trpc.trackerProjects.get.infiniteQueryOptions(
    {
      ...filter,
      sort,
    },
    {
      getNextPageParam: ({ meta }) => meta?.cursor,
    },
  );
  const trackerProjectsResult = await getTrackerProjectsLocally({
    ...filter,
    sort,
  }).catch(() => null);

  if (trackerProjectsResult) {
    queryClient.setQueryData(trackerProjectsQuery.queryKey, {
      pages: [trackerProjectsResult],
      pageParams: [null],
    });
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    weeklyCalendar,
  };
}

export async function buildUpgradePageData() {
  return buildShellOnlyPageData();
}

export async function buildTeamsSelectionPageData() {
  const { queryClient, user } = await buildBaseAppShellState({
    allowIncomplete: true,
  });
  const [teams, invites] = await Promise.all([
    getCurrentUserTeamsLocally(),
    getTeamInvitesByEmailLocally(),
  ]);

  queryClient.setQueryData(trpc.team.list.queryKey(), teams);
  queryClient.setQueryData(trpc.team.invitesByEmail.queryKey(), invites);

  if (!teams.length && !invites.length) {
    throw redirect({
      to: "/onboarding",
      throw: true,
    });
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    teams,
    invites,
  };
}

export async function buildChatPageData(id: string) {
  const { queryClient, user } = await buildBaseAppShellState();
  const chat = await getChatMessagesLocally(id);

  if (!chat) {
    throw redirect({
      to: "/dashboard",
      throw: true,
    });
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    chat,
    geo: geolocation(getStartContext().request.headers as Headers),
  };
}

export async function buildOnboardingPageData() {
  const { queryClient, user } = await buildBaseAppShellState({
    allowIncomplete: true,
  });

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    defaultCurrency: await getCurrency(),
    defaultCountryCode: await getCountryCode(),
  };
}

export async function buildCustomerPortalPageData(portalId: string) {
  const queryClient = getQueryClient();
  const portalDataQuery = trpc.customers.getByPortalId.queryOptions({
    portalId,
  });
  const portalInvoicesQuery = trpc.customers.getPortalInvoices.infiniteQueryOptions(
    {
      portalId,
    },
    {
      getNextPageParam: ({ meta }) => meta?.cursor,
    },
  );

  let portalData;
  let portalInvoices;

  try {
    [portalData, portalInvoices] = await Promise.all([
      getCustomerPortalDataLocally(portalId),
      getCustomerPortalInvoicesLocally(portalId),
    ]);
  } catch (error) {
    if (isLocalPublicReadUnavailable(error)) {
      return {
        status: "not-found" as const,
      };
    }

    throw error;
  }

  if (!portalData) {
    return {
      status: "not-found" as const,
    };
  }

  queryClient.setQueryData(portalDataQuery.queryKey, portalData);
  queryClient.setQueryData(portalInvoicesQuery.queryKey, {
    pages: [portalInvoices],
    pageParams: [null],
  });

  const customerName = portalData.customer.name;
  const teamName = portalData.customer.team.name || "Tamias";

  return {
    status: "ok" as const,
    portalId,
    dehydratedState: dehydrateQueryClient(queryClient),
    metadata: {
      title: `${customerName} | ${teamName}`,
      description: `Customer portal for ${customerName}`,
    },
  };
}

export async function buildPublicReportPageData(linkId: string) {
  const queryClient = getQueryClient();
  let report;

  try {
    report = await getReportByLinkIdLocally(linkId);
  } catch (error) {
    if (isLocalPublicReadUnavailable(error)) {
      return {
        status: "not-found" as const,
      };
    }

    throw error;
  }

  if (!report) {
    return {
      status: "not-found" as const,
    };
  }

  if (report.expireAt && new Date(report.expireAt) < new Date()) {
    return {
      status: "not-found" as const,
    };
  }

  const chartName = report.type
    ? getChartDisplayName(report.type as any)
    : "Shared Report";
  const teamName = report.teamName || "Company";
  const dateRangeDisplay =
    report.from && report.to
      ? `${format(parseISO(report.from), "MMM d")} - ${format(
          parseISO(report.to),
          "MMM d, yyyy",
        )}`
      : "";
  const chartDataQuery = trpc.reports.getChartDataByLinkId.queryOptions({
    linkId,
  });
  const chartDataResult = await getReportChartDataByLinkIdLocally(linkId)
    .then((chartData) => ({ status: "fulfilled" as const, chartData }))
    .catch(() => ({ status: "rejected" as const }));

  if (chartDataResult.status === "fulfilled") {
    queryClient.setQueryData(
      chartDataQuery.queryKey,
      chartDataResult.chartData,
    );
  }

  return {
    status: "ok" as const,
    report,
    chartName,
    teamName,
    dateRangeDisplay,
    dehydratedState: dehydrateQueryClient(queryClient),
    metadata: {
      title: `${teamName} - ${chartName}`,
      description: `Shared ${chartName} report from ${teamName}`,
    },
  };
}

export async function buildShortLinkPageData(shortId: string) {
  let shortLink;

  try {
    shortLink = await getShortLinkLocally(shortId);
  } catch (error) {
    if (isLocalPublicReadUnavailable(error)) {
      return {
        status: "not-found" as const,
      };
    }

    throw error;
  }

  if (!shortLink?.url) {
    return {
      status: "not-found" as const,
    };
  }

  if (shortLink.expiresAt && new Date(shortLink.expiresAt) < new Date()) {
    return {
      status: "not-found" as const,
    };
  }

  if (shortLink.type === "redirect") {
    return {
      status: "redirect" as const,
      href: shortLink.url,
    };
  }

  return {
    status: "ok" as const,
    shortLink,
  };
}

export async function buildOAuthAuthorizePageData(href?: string) {
  const requestUrl = getRequestUrl(href);
  const queryClient = getQueryClient();
  const {
    response_type,
    client_id,
    redirect_uri,
    scope,
    state,
  } = loadOAuthParams(Object.fromEntries(requestUrl.searchParams.entries()));
  const validation = validateOAuthParams({
    response_type: response_type || undefined,
    client_id: client_id || undefined,
    redirect_uri: redirect_uri || undefined,
    scope: scope || undefined,
  });

  if (!validation.isValid) {
    return {
      status: "error" as const,
      errorType: validation.errorType!,
    };
  }

  const currentUser = await getCurrentUserLocally();

  if (!currentUser) {
    return {
      status: "error" as const,
      errorType: "user_not_authenticated" as const,
    };
  }

  try {
    const applicationInfoQuery =
      trpc.oauthApplications.getApplicationInfo.queryOptions({
        clientId: client_id!,
        redirectUri: redirect_uri!,
        scope: scope!,
        state: state || undefined,
      });
    const [applicationInfo, teams, currentTeam] = await Promise.all([
      getOAuthApplicationInfoLocally({
        clientId: client_id!,
        redirectUri: redirect_uri!,
        scope: scope!,
        state: state || undefined,
      }),
      getCurrentUserTeamsLocally(),
      getCurrentTeamLocally(),
    ]);

    queryClient.setQueryData(applicationInfoQuery.queryKey, applicationInfo);
    queryClient.setQueryData(trpc.team.list.queryKey(), teams);
    queryClient.setQueryData(trpc.team.current.queryKey(), currentTeam);
    queryClient.setQueryData(trpc.user.me.queryKey(), currentUser);

    return {
      status: "ready" as const,
      dehydratedState: dehydrateQueryClient(queryClient),
    };
  } catch (error) {
    const { errorType, customMessage, details } = categorizeOAuthError(error);

    return {
      status: "error" as const,
      errorType,
      customMessage,
      details,
    };
  }
}

export async function buildPublicInvoicePageData(params: {
  token: string;
  viewer?: string;
}) {
  const authToken = await getConvexAuthToken();
  let invoice;

  try {
    invoice = await getInvoiceByTokenLocally(params.token);
  } catch (error) {
    if (isLocalPublicReadUnavailable(error)) {
      return {
        status: "not-found" as const,
      };
    }

    throw error;
  }

  if (!invoice) {
    return {
      status: "not-found" as const,
    };
  }

  if (params.viewer && params.viewer.trim().length > 0) {
    try {
      const decryptedEmail = decrypt(params.viewer);

      if (decryptedEmail === invoice.customer?.email) {
        const client = await getTRPCClient();
        await client.invoice.markViewedByToken.mutate({
          token: params.token,
        });
      }
    } catch {
      // Ignore invalid viewer tokens.
    }
  }

  if (invoice.status === "draft" && !authToken) {
    return {
      status: "not-found" as const,
    };
  }

  const width = invoice.template.size === "letter" ? 750 : 595;
  const height = invoice.template.size === "letter" ? 1056 : 842;
  const paymentEnabled =
    invoice.template.paymentEnabled && invoice.team?.stripeConnected === true;

  return {
    status: "ok" as const,
    invoice,
    width,
    height,
    paymentEnabled,
    metadata: {
      title: `Invoice ${invoice.invoiceNumber} | ${invoice.team?.name}`,
      description: `Invoice for ${invoice.customerName || invoice.customer?.name || "Customer"}`,
    },
  };
}
