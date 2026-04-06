"use client";

import type { AppRouter } from "@tamias/trpc";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { createContext, useContext, useMemo } from "react";
import { useMetricsFilter } from "@/hooks/use-metrics-filter";
import { useTRPC } from "@/trpc/client";
import { usePrimaryWidgets } from "./widget-provider";
import { WIDGET_POLLING_CONFIG } from "./widget-config";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type OverviewWidgetResultMap = {
  runway: RouterOutputs["widgets"]["getRunway"];
  "cash-flow": RouterOutputs["widgets"]["getCashFlow"];
  "account-balances": RouterOutputs["widgets"]["getAccountBalances"];
  "profit-analysis": RouterOutputs["reports"]["profit"];
  "revenue-forecast": RouterOutputs["reports"]["revenueForecast"];
  "revenue-summary": RouterOutputs["widgets"]["getRevenueSummary"];
  "growth-rate": RouterOutputs["widgets"]["getGrowthRate"];
};

const SUPPORTED_OVERVIEW_WIDGETS = [
  "runway",
  "cash-flow",
  "account-balances",
  "profit-analysis",
  "revenue-forecast",
  "revenue-summary",
  "growth-rate",
] as const;

type SupportedOverviewWidget = (typeof SUPPORTED_OVERVIEW_WIDGETS)[number];

type OverviewWidgetDataContextValue = {
  data?: Partial<OverviewWidgetResultMap>;
  requestedWidgets: Set<SupportedOverviewWidget>;
  isLoading: boolean;
  isError: boolean;
};

const OverviewWidgetDataContext = createContext<OverviewWidgetDataContextValue | null>(null);

function isSupportedOverviewWidget(widget: string): widget is SupportedOverviewWidget {
  return (SUPPORTED_OVERVIEW_WIDGETS as readonly string[]).includes(widget);
}

export function OverviewWidgetDataProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const trpc = useTRPC();
  const primaryWidgets = usePrimaryWidgets();
  const { from, to, currency, revenueType } = useMetricsFilter();

  const requestedWidgetList = useMemo(
    () => primaryWidgets.filter(isSupportedOverviewWidget),
    [primaryWidgets],
  );

  const requestedWidgets = useMemo(
    () => new Set<SupportedOverviewWidget>(requestedWidgetList),
    [requestedWidgetList],
  );

  const overviewQuery = useQuery({
    ...trpc.widgets.getOverview.queryOptions({
      widgets: requestedWidgetList,
      from,
      to,
      currency,
      revenueType,
    }),
    ...WIDGET_POLLING_CONFIG,
    enabled: requestedWidgetList.length > 0,
    placeholderData: (previousData) => previousData,
  });

  const contextValue = useMemo<OverviewWidgetDataContextValue>(
    () => ({
      data: overviewQuery.data as Partial<OverviewWidgetResultMap> | undefined,
      requestedWidgets,
      isLoading: overviewQuery.isLoading,
      isError: overviewQuery.isError,
    }),
    [overviewQuery.data, overviewQuery.isError, overviewQuery.isLoading, requestedWidgets],
  );

  return (
    <OverviewWidgetDataContext.Provider value={contextValue}>
      {children}
    </OverviewWidgetDataContext.Provider>
  );
}

export function useOverviewWidgetQuery<TKey extends SupportedOverviewWidget>(
  widget: TKey,
  queryOptions: any,
) {
  const overviewContext = useContext(OverviewWidgetDataContext);
  const shouldWaitForOverview =
    !!overviewContext?.requestedWidgets.has(widget) && !overviewContext?.isError;
  const overviewData = overviewContext?.data?.[widget] as OverviewWidgetResultMap[TKey] | undefined;

  const fallbackQuery = useQuery({
    ...queryOptions,
    enabled:
      (queryOptions.enabled ?? true) && (!shouldWaitForOverview || overviewData === undefined),
  });

  return {
    ...fallbackQuery,
    data: (overviewData ?? fallbackQuery.data) as OverviewWidgetResultMap[TKey] | undefined,
    isLoading:
      shouldWaitForOverview && overviewData === undefined
        ? (overviewContext?.isLoading ?? false)
        : fallbackQuery.isLoading,
  };
}
