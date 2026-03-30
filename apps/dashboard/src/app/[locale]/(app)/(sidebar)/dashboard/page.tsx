import { Provider as ChatProvider } from "@ai-sdk-tools/store";
import { isOverviewWidgetType } from "@tamias/app-services/widgets";
import type { Metadata } from "next";
import { headers } from "next/headers";
import type { SearchParams } from "nuqs/server";
import { DeferredHomeChat } from "@/components/chat/deferred-home-chat";
import { Widgets } from "@/components/widgets";
import { getCurrentTeamLocally } from "@/server/loaders/identity";
import { getInitialMetricsFilter } from "@/server/loaders/metrics";
import {
  getCurrentWidgetPreferencesLocally,
  getOverviewWidgetsLocally,
} from "@/server/loaders/widgets";
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
  const [searchParams, widgetPreferences, currentTeam] = await Promise.all([
    props.searchParams,
    getCurrentWidgetPreferencesLocally(),
    getCurrentTeamLocally(),
  ]);

  const metricsFilter = getInitialMetricsFilter(
    searchParams,
    currentTeam?.fiscalYearStartMonth,
  );
  const overviewWidgets =
    widgetPreferences.primaryWidgets.filter(isOverviewWidgetType);
  const shouldHydrateOverview =
    metricsFilter.tab !== "metrics" && overviewWidgets.length > 0;

  const [overviewData] = await Promise.all([
    shouldHydrateOverview
      ? getOverviewWidgetsLocally(
          overviewWidgets.join(","),
          metricsFilter.from,
          metricsFilter.to,
          metricsFilter.currency,
          metricsFilter.revenueType,
        )
      : null,
  ]);

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

  return (
    <HydrateClient>
      <ChatProvider initialMessages={[]} key="home">
        <Widgets initialPreferences={widgetPreferences} />

        <DeferredHomeChat geo={geo} />
      </ChatProvider>
    </HydrateClient>
  );
}
