import { getStartContext } from "@tanstack/start-storage-context";
import { redirect } from "@tanstack/react-router";
import { getQueryClient, trpc } from "@/trpc/server";
import { hasCompletedOnboarding } from "@/utils/auth-routing";
import { geolocation } from "@/utils/geo";
import { dehydrateQueryClient, isUnauthorizedQueryError } from "@/start/server/route-data/shared";

export async function buildDashboardPageData(href?: string) {
  void href;
  const queryClient = getQueryClient();
  const currentUserQuery = trpc.user.me.queryOptions();
  const userResult = await queryClient.fetchQuery(currentUserQuery).catch((error) => {
    if (isUnauthorizedQueryError(error)) {
      throw redirect({
        to: "/login",
        throw: true,
      });
    }

    throw error;
  });

  const user = userResult;

  if (!user) {
    throw redirect({
      to: "/login",
      throw: true,
    });
  }

  if (!hasCompletedOnboarding(user)) {
    throw redirect({
      to: "/onboarding",
      throw: true,
    });
  }

  const widgetPreferencesQuery = trpc.widgets.getWidgetPreferences.queryOptions();
  const widgetPreferences = await queryClient.fetchQuery(widgetPreferencesQuery).catch((error) => {
    if (isUnauthorizedQueryError(error)) {
      throw redirect({
        to: "/login",
        throw: true,
      });
    }

    throw error;
  });

  return {
    dehydratedState: dehydrateQueryClient(queryClient),
    user,
    initialPreferences: widgetPreferences,
    geo: geolocation(getStartContext().request.headers as Headers),
  };
}
