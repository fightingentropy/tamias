import { Provider as ChatProvider } from "@ai-sdk-tools/store";
import {
  isContextualHydratableWidgetType,
  isHydratableStandaloneWidgetType,
  isOverviewWidgetType,
} from "@tamias/app-services/widgets";
import type { Metadata } from "next";
import { headers } from "next/headers";
import type { SearchParams } from "nuqs/server";
import { ChatInterface } from "@/components/chat/chat-interface";
import { Widgets } from "@/components/widgets";
import { getInitialMetricsFilter } from "@/server/loaders/metrics";
import {
  getContextualHydratableWidgetsLocally,
  getContextualWidgetHydrationInputs,
  getHydratableStandaloneWidgetsLocally,
  getOverviewWidgetsLocally,
  getCurrentWidgetPreferencesLocally,
  getSuggestedActionsLocally,
} from "@/server/loaders/widgets";
import {
  getCurrentTeamLocally,
  getCurrentUserLocally,
} from "@/server/loaders/identity";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { geolocation } from "@/utils/geo";

export const metadata: Metadata = {
  title: "Dashboard | Tamias",
};

type Props = {
  searchParams: Promise<SearchParams>;
};

export default async function DashboardPage(props: Props) {
  const headersList = await headers();
  const geo = geolocation(headersList);
  const queryClient = getQueryClient();
  const suggestedActionsQuery = trpc.suggestedActions.list.queryOptions({
    limit: 6,
  });
  const [
    searchParams,
    widgetPreferences,
    suggestedActions,
    currentTeam,
    currentUser,
  ] =
    await Promise.all([
      props.searchParams,
      getCurrentWidgetPreferencesLocally(),
      getSuggestedActionsLocally(6),
      getCurrentTeamLocally(),
      getCurrentUserLocally(),
    ]);

  const metricsFilter = getInitialMetricsFilter(
    searchParams,
    currentTeam?.fiscalYearStartMonth,
  );
  const overviewWidgets = widgetPreferences.primaryWidgets.filter(
    isOverviewWidgetType,
  );
  const standaloneWidgets = widgetPreferences.primaryWidgets.filter(
    isHydratableStandaloneWidgetType,
  );
  const contextualWidgets = widgetPreferences.primaryWidgets.filter(
    isContextualHydratableWidgetType,
  );
  const shouldHydrateOverview =
    metricsFilter.tab !== "metrics" && overviewWidgets.length > 0;
  const shouldHydrateStandalone =
    metricsFilter.tab !== "metrics" && standaloneWidgets.length > 0;
  const shouldHydrateContextual =
    metricsFilter.tab !== "metrics" && contextualWidgets.length > 0;
  const contextualHydrationInputs = shouldHydrateContextual
    ? getContextualWidgetHydrationInputs({
        timezone: geo.timezone ?? currentUser?.timezone,
        weekStartsOnMonday: currentUser?.weekStartsOnMonday,
      })
    : null;

  const [overviewData, standaloneWidgetData, contextualWidgetData] =
    await Promise.all([
    shouldHydrateOverview
      ? getOverviewWidgetsLocally(
          overviewWidgets.join(","),
          metricsFilter.from,
          metricsFilter.to,
          metricsFilter.currency,
          metricsFilter.revenueType,
        )
      : null,
    shouldHydrateStandalone
      ? getHydratableStandaloneWidgetsLocally(
          standaloneWidgets.join(","),
          metricsFilter.from,
          metricsFilter.to,
          metricsFilter.currency,
          metricsFilter.revenueType,
        )
      : null,
      shouldHydrateContextual && contextualHydrationInputs
          ? getContextualHydratableWidgetsLocally(
            contextualWidgets.join(","),
            metricsFilter.currency,
            contextualHydrationInputs.inboxFrom,
            contextualHydrationInputs.inboxTo,
            contextualHydrationInputs.trackedTimeFrom,
            contextualHydrationInputs.trackedTimeTo,
            currentUser?.convexId,
            contextualHydrationInputs.billableDate,
            contextualHydrationInputs.weekStartsOnMonday,
          )
        : null,
    ]);

  queryClient.setQueryData(
    trpc.widgets.getWidgetPreferences.queryKey(),
    widgetPreferences,
  );
  queryClient.setQueryData(suggestedActionsQuery.queryKey, suggestedActions);

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

  if (standaloneWidgetData) {
    for (const [widget, data] of Object.entries(standaloneWidgetData)) {
      const widgetData = data as any;

      switch (widget) {
        case "top-customer":
          queryClient.setQueryData(
            trpc.widgets.getTopCustomer.queryKey(),
            widgetData,
          );
          break;
        case "outstanding-invoices":
          queryClient.setQueryData(
            trpc.widgets.getOutstandingInvoices.queryKey({
              currency: metricsFilter.currency,
              status: ["unpaid", "overdue"],
            }),
            widgetData,
          );
          break;
        case "overdue-invoices-alert":
          queryClient.setQueryData(
            trpc.widgets.getOverdueInvoicesAlert.queryKey(),
            widgetData,
          );
          break;
        case "net-position":
          queryClient.setQueryData(
            trpc.widgets.getNetPosition.queryKey({
              currency: metricsFilter.currency,
            }),
            widgetData,
          );
          break;
        case "monthly-spending":
          queryClient.setQueryData(
            trpc.widgets.getMonthlySpending.queryKey({
              from: metricsFilter.from,
              to: metricsFilter.to,
            }),
            widgetData,
          );
          break;
        case "recurring-expenses":
          queryClient.setQueryData(
            trpc.widgets.getRecurringExpenses.queryKey({
              from: metricsFilter.from,
              to: metricsFilter.to,
            }),
            widgetData,
          );
          break;
        case "category-expenses":
          queryClient.setQueryData(
            trpc.widgets.getCategoryExpenses.queryKey({
              from: metricsFilter.from,
              to: metricsFilter.to,
              limit: 3,
            }),
            widgetData,
          );
          break;
        case "profit-margin":
          queryClient.setQueryData(
            trpc.widgets.getProfitMargin.queryKey({
              from: metricsFilter.from,
              to: metricsFilter.to,
              currency: metricsFilter.currency,
              revenueType: metricsFilter.revenueType,
            }),
            widgetData,
          );
          break;
        case "tax-summary":
          queryClient.setQueryData(
            trpc.widgets.getTaxSummary.queryKey({
              from: metricsFilter.from,
              to: metricsFilter.to,
            }),
            widgetData,
          );
          break;
        case "vault":
          queryClient.setQueryData(
            trpc.widgets.getVaultActivity.queryKey({
              limit: 3,
            }),
            widgetData,
          );
          break;
        case "customer-lifetime-value":
          queryClient.setQueryData(
            trpc.widgets.getCustomerLifetimeValue.queryKey({
              currency: metricsFilter.currency,
            }),
            widgetData,
          );
          break;
      }
    }
  }

  if (contextualWidgetData && contextualHydrationInputs) {
    for (const [widget, data] of Object.entries(contextualWidgetData)) {
      const widgetData = data as any;

      switch (widget) {
        case "inbox":
          queryClient.setQueryData(
            trpc.widgets.getInboxStats.queryKey({
              from: contextualHydrationInputs.inboxFrom,
              to: contextualHydrationInputs.inboxTo,
              currency: metricsFilter.currency,
            }),
            widgetData,
          );
          break;
        case "time-tracker":
          queryClient.setQueryData(
            trpc.widgets.getTrackedTime.queryKey({
              from: contextualHydrationInputs.trackedTimeFrom,
              to: contextualHydrationInputs.trackedTimeTo,
            }),
            widgetData,
          );
          break;
        case "billable-hours":
          queryClient.setQueryData(
            trpc.widgets.getBillableHours.queryKey({
              date: contextualHydrationInputs.billableDate,
              view: "month",
              weekStartsOnMonday:
                contextualHydrationInputs.weekStartsOnMonday,
            }),
            widgetData,
          );
          break;
        case "invoice-payment-score":
          queryClient.setQueryData(
            trpc.invoice.paymentStatus.queryKey(),
            widgetData,
          );
          break;
      }
    }
  }

  return (
    <HydrateClient>
      <ChatProvider initialMessages={[]} key="home">
        <Widgets initialPreferences={widgetPreferences} />

        <ChatInterface geo={geo} />
      </ChatProvider>
    </HydrateClient>
  );
}
