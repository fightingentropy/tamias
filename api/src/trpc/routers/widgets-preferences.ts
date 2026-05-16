import { getWidgetPreferences, updateWidgetPreferences } from "@tamias/app-data/queries";
import { updateWidgetPreferencesSchema } from "../../schemas/widgets";
import { protectedProcedure } from "../init";
import { requireWidgetUserId } from "./widgets-shared";

export const widgetPreferenceProcedures = {
  getWidgetPreferences: protectedProcedure.query(
    async ({ ctx: { db, teamId, session, accessToken } }) => {
      return getWidgetPreferences(db, {
        teamId: teamId!,
        userId: session.user.id,
        accessToken,
      });
    },
  ),

  updateWidgetPreferences: protectedProcedure
    .input(updateWidgetPreferencesSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      return updateWidgetPreferences(db, {
        teamId: teamId!,
        userId: requireWidgetUserId(session),
        primaryWidgets: input.primaryWidgets,
      });
    }),
};
