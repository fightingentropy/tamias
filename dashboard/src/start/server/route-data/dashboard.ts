import { getStartContext } from "@tanstack/start-storage-context";
import { trpc } from "@/trpc/server";
import { geolocation } from "@/utils/geo";
import { buildBaseAppShellState, dehydrateQueryClient } from "@/start/server/route-data/shared";

export async function buildDashboardPageData(_href?: string) {
  const { queryClient, user } = await buildBaseAppShellState();
  const widgetPreferencesQuery = trpc.widgets.getWidgetPreferences.queryOptions();
  const initialPreferences = await queryClient.fetchQuery(widgetPreferencesQuery);

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    initialPreferences,
    geo: geolocation(getStartContext().request.headers as Headers),
  };
}
