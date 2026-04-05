import { isOverviewWidgetType } from "@tamias/app-services/widgets";
import { getStartContext } from "@tanstack/start-storage-context";
import { getInitialMetricsFilter } from "@/server/loaders/metrics";
import { batchPrefetch, trpc } from "@/trpc/server";
import { geolocation } from "@/utils/geo";
import {
  buildBaseAppShellState,
  dehydrateQueryClient,
  getRequestUrl,
} from "@/start/server/route-data/shared";

export async function buildDashboardPageData(href?: string) {
  const { queryClient, user, team } = await buildBaseAppShellState();
  const requestUrl = getRequestUrl(href);
  const metricsFilter = getInitialMetricsFilter(
    Object.fromEntries(requestUrl.searchParams.entries()),
    team?.fiscalYearStartMonth,
  );
  const overviewCurrency = metricsFilter.currency ?? team?.baseCurrency ?? undefined;
  const widgetPreferencesQuery = trpc.widgets.getWidgetPreferences.queryOptions();
  const suggestedActionsQuery = trpc.suggestedActions.list.queryOptions({
    limit: 6,
  });
  const widgetPreferences = await queryClient.fetchQuery(widgetPreferencesQuery);
  const overviewWidgets =
    widgetPreferences.primaryWidgets.filter(isOverviewWidgetType);
  const shouldHydrateOverview =
    metricsFilter.tab !== "metrics" && overviewWidgets.length > 0;

  if (shouldHydrateOverview) {
    const overviewQuery = trpc.widgets.getOverview.queryOptions({
      widgets: overviewWidgets,
      from: metricsFilter.from,
      to: metricsFilter.to,
      currency: overviewCurrency,
      revenueType: metricsFilter.revenueType,
    });

    await batchPrefetch([overviewQuery, suggestedActionsQuery]);
  } else {
    await batchPrefetch([suggestedActionsQuery]);
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    initialPreferences: widgetPreferences,
    geo: geolocation(getStartContext().request.headers as Headers),
  };
}
