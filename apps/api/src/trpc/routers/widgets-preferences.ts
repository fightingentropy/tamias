import {
  getWidgetPreferencesFromConvex,
  getWidgetPreferencesFromConvexAsAuthUser,
  updateWidgetPreferencesInConvex,
} from "@tamias/app-services/widgets";
import { DEFAULT_WIDGET_PREFERENCES } from "@tamias/domain";
import { updateWidgetPreferencesSchema } from "../../schemas/widgets";
import { isMissingConvexServiceKeyError } from "../convex-service-dev-fallback";
import { protectedProcedure } from "../init";
import { requireWidgetConvexUserId } from "./widgets-shared";

export const widgetPreferenceProcedures = {
  getWidgetPreferences: protectedProcedure.query(
    async ({ ctx: { teamId, session, accessToken } }) => {
      const fromAuthUser =
        accessToken && !accessToken.startsWith("mid_")
          ? await getWidgetPreferencesFromConvexAsAuthUser(accessToken)
          : null;

      if (fromAuthUser) {
        return fromAuthUser;
      }

      try {
        return await getWidgetPreferencesFromConvex({
          teamId: teamId!,
          userId: requireWidgetConvexUserId(session),
        });
      } catch (error) {
        if (isMissingConvexServiceKeyError(error)) {
          return DEFAULT_WIDGET_PREFERENCES;
        }

        throw error;
      }
    },
  ),

  updateWidgetPreferences: protectedProcedure
    .input(updateWidgetPreferencesSchema)
    .mutation(async ({ ctx: { teamId, session }, input }) => {
      return updateWidgetPreferencesInConvex({
        teamId: teamId!,
        userId: requireWidgetConvexUserId(session),
        primaryWidgets: input.primaryWidgets,
      });
    }),
};
