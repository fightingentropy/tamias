import "server-only";

import {
  buildSuggestedActionsList,
  getSuggestedActionUsageFromConvex,
} from "@tamias/app-services/suggested-actions";
import { getWidgetPreferencesFromConvex } from "@tamias/app-services/widgets";
import { DEFAULT_WIDGET_PREFERENCES } from "@tamias/domain";
import { cache } from "react";
import { measureServerRead } from "@/server/perf";
import { getCurrentSession } from "./context";
import type { LocalSuggestedActions, LocalWidgetPreferences } from "./types";

export const getSuggestedActionsLocally = cache(
  async (limit: number): Promise<LocalSuggestedActions> => {
    return measureServerRead("getSuggestedActionsLocally", async () => {
      const session = await getCurrentSession();

      if (!session?.teamId || !session.user.convexId) {
        return buildSuggestedActionsList({
          allUsage: {},
          limit,
        });
      }

      const allUsage = await getSuggestedActionUsageFromConvex({
        teamId: session.teamId,
        userId: session.user.convexId,
      });

      return buildSuggestedActionsList({
        allUsage,
        limit,
      });
    });
  },
);

export const getCurrentWidgetPreferencesLocally = cache(
  async (): Promise<LocalWidgetPreferences> => {
    return measureServerRead("getCurrentWidgetPreferencesLocally", async () => {
      const session = await getCurrentSession();

      if (!session?.teamId || !session.user.convexId) {
        return DEFAULT_WIDGET_PREFERENCES;
      }

      return getWidgetPreferencesFromConvex({
        teamId: session.teamId,
        userId: session.user.convexId,
      });
    });
  },
);
