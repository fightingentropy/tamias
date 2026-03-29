import { updateWidgetPreferencesSchema } from "../../schemas/widgets";
import {
  getWidgetPreferencesFromConvex,
  updateWidgetPreferencesInConvex,
} from "@tamias/app-services/widgets";
import { protectedProcedure } from "../init";
import { requireWidgetConvexUserId } from "./widgets-shared";

export const widgetPreferenceProcedures = {
  getWidgetPreferences: protectedProcedure.query(
    async ({ ctx: { teamId, session } }) => {
      return getWidgetPreferencesFromConvex({
        teamId: teamId!,
        userId: requireWidgetConvexUserId(session),
      });
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
