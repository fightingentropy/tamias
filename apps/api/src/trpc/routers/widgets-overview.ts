import { getOverviewWidgetsSchema } from "../../schemas/widgets";
import { getOverviewWidgetsData } from "@tamias/app-services/widgets";
import { protectedProcedure } from "../init";

export const widgetOverviewProcedures = {
  getOverview: protectedProcedure
    .input(getOverviewWidgetsSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return getOverviewWidgetsData({
        db,
        teamId: teamId!,
        widgets: input.widgets,
        from: input.from,
        to: input.to,
        currency: input.currency,
        revenueType: input.revenueType,
      });
    }),
};
