import { api } from "@tamias/convex-model/api";
import type { Id } from "@tamias/convex-model/data-model";
import type { WidgetType } from "@tamias/domain";
import { getConvexServiceKey, getSharedConvexClient } from "./convex-client";

function serviceArgs<T extends Record<string, unknown>>(args: T) {
  return {
    serviceKey: getConvexServiceKey(),
    ...args,
  };
}

export async function getWidgetPreferencesFromConvex(args: {
  userId: Id<"appUsers">;
  teamId: string;
}) {
  return getSharedConvexClient().query(
    api.widgets.serviceGetWidgetPreferences,
    serviceArgs(args),
  );
}

export async function updateWidgetPreferencesInConvex(args: {
  userId: Id<"appUsers">;
  teamId: string;
  primaryWidgets: WidgetType[];
}) {
  return getSharedConvexClient().mutation(
    api.widgets.serviceUpdateWidgetPreferences,
    serviceArgs(args),
  );
}
