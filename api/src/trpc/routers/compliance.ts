import { upsertFilingProfile } from "@tamias/app-data/queries";
import { getComplianceProfileForTeam } from "@tamias/app-services/compliance";
import { upsertFilingProfileSchema } from "../../schemas/compliance";
import { createTRPCRouter, protectedProcedure } from "../init";

export const complianceRouter = createTRPCRouter({
  getProfile: protectedProcedure.query(async ({ ctx: { db, teamId } }) => {
    return getComplianceProfileForTeam({
      db,
      teamId: teamId!,
    });
  }),

  upsertProfile: protectedProcedure
    .input(upsertFilingProfileSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return upsertFilingProfile(db, {
        teamId: teamId!,
        ...input,
      });
    }),
});
