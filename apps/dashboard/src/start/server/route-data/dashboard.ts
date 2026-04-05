import { getStartContext } from "@tanstack/start-storage-context";
import { redirect } from "@tanstack/react-router";
import { getQueryClient, trpc } from "@/trpc/server";
import { geolocation } from "@/utils/geo";
import {
  dehydrateQueryClient,
  isUnauthorizedQueryError,
} from "@/start/server/route-data/shared";

export async function buildDashboardPageData(href?: string) {
  void href;
  const queryClient = getQueryClient();
  const currentUserQuery = trpc.user.me.queryOptions();
  const widgetPreferencesQuery = trpc.widgets.getWidgetPreferences.queryOptions();
  const [userResult, widgetPreferencesResult] = await Promise.allSettled([
    queryClient.fetchQuery(currentUserQuery),
    queryClient.fetchQuery(widgetPreferencesQuery),
  ]);

  if (userResult.status === "rejected") {
    if (isUnauthorizedQueryError(userResult.reason)) {
      throw redirect({
        to: "/login",
        throw: true,
      });
    }

    throw userResult.reason;
  }

  if (widgetPreferencesResult.status === "rejected") {
    if (isUnauthorizedQueryError(widgetPreferencesResult.reason)) {
      throw redirect({
        to: "/login",
        throw: true,
      });
    }

    throw widgetPreferencesResult.reason;
  }

  const user = userResult.value;

  if (!user) {
    throw redirect({
      to: "/login",
      throw: true,
    });
  }

  if (!user.fullName || !user.teamId) {
    throw redirect({
      to: "/onboarding",
      throw: true,
    });
  }

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    initialPreferences: widgetPreferencesResult.value,
    geo: geolocation(getStartContext().request.headers as Headers),
  };
}
