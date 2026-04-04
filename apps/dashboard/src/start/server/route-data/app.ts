import { getCountryCode, getCurrency } from "@tamias/location/server";
import { isOverviewWidgetType } from "@tamias/app-services/widgets";
import { redirect } from "@tanstack/react-router";
import { getStartContext } from "@tanstack/start-storage-context";
import { cookies } from "@tamias/utils/request-runtime";
import { loadCustomerFilterParams } from "@/hooks/use-customer-filter-params";
import { loadDocumentFilterParams } from "@/hooks/use-document-filter-params";
import { loadInvoiceFilterParams } from "@/hooks/use-invoice-filter-params";
import { loadSortParams } from "@/hooks/use-sort-params";
import { loadTrackerFilterParams } from "@/hooks/use-tracker-filter-params";
import { loadTransactionFilterParams } from "@/hooks/use-transaction-filter-params";
import { loadTransactionTab } from "@/hooks/use-transaction-tab";
import {
  getApiKeysLocally,
  getAuthorizedOAuthApplicationsLocally,
  getInstalledAppsLocally,
  getOAuthApplicationsLocally,
  getStripeStatusLocally,
} from "@/server/loaders/apps";
import { getChatMessagesLocally } from "@/server/loaders/chat";
import {
  getCustomersLocally,
  getInactiveClientsCountLocally,
  getMostActiveClientLocally,
  getNewCustomersCountLocally,
  getTopRevenueClientLocally,
} from "@/server/loaders/customers";
import { getDocumentsLocally } from "@/server/loaders/documents";
import {
  getCurrentTeamMembersLocally,
  getTeamInvitesByEmailLocally,
  getCurrentUserTeamsLocally,
} from "@/server/loaders/identity";
import { getInboxAccountsLocally } from "@/server/loaders/inbox";
import { getInvoiceProductsLocally } from "@/server/loaders/invoice-products";
import {
  getInvoiceListLocally,
  getInvoicePaymentStatusLocally,
  getInvoiceSummaryLocally,
} from "@/server/loaders/invoices";
import { getInitialMetricsFilter } from "@/server/loaders/metrics";
import { getCurrentTeamTagsLocally } from "@/server/loaders/tags";
import { getTrackerProjectsLocally } from "@/server/loaders/tracker";
import {
  getTransactionsLocally,
  getTransactionsReviewCountLocally,
  getTransactionCategoriesLocally,
} from "@/server/loaders/transactions";
import {
  getCurrentWidgetPreferencesLocally,
  getOverviewWidgetsLocally,
} from "@/server/loaders/widgets";
import { trpc } from "@/trpc/server";
import { getInitialTableSettings } from "@/utils/columns";
import { Cookies } from "@/utils/constants";
import { geolocation } from "@/utils/geo";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
  getCanonicalHostContext,
  getRequestUrl,
} from "@/start/server/route-data/shared";

export async function buildDashboardPageData(href?: string) {
  const { queryClient, user, team } = await buildBaseAppShellState();
  const requestUrl = getRequestUrl(href);
  const widgetPreferences = await getCurrentWidgetPreferencesLocally();
  const metricsFilter = getInitialMetricsFilter(
    Object.fromEntries(requestUrl.searchParams.entries()),
    team?.fiscalYearStartMonth,
  );
  const overviewCurrency = metricsFilter.currency ?? team?.baseCurrency ?? undefined;
  const overviewWidgets =
    widgetPreferences.primaryWidgets.filter(isOverviewWidgetType);
  const shouldHydrateOverview =
    metricsFilter.tab !== "metrics" && overviewWidgets.length > 0;
  const overviewData = shouldHydrateOverview
    ? await getOverviewWidgetsLocally(
        overviewWidgets.join(","),
        metricsFilter.from,
        metricsFilter.to,
        overviewCurrency,
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
      currency: overviewCurrency,
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
  const { queryClient, user } = await buildBaseAppShellState();

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
  };
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
