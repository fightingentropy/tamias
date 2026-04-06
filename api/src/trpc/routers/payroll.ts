import { generatePayrollExport, importPayrollRun, listPayrollRuns } from "@tamias/app-data/queries";
import { getPayrollDashboardForTeam } from "@tamias/app-services/compliance";
import { generatePayrollExportSchema, importPayrollRunSchema } from "../../schemas/compliance";
import { createTRPCRouter, protectedProcedure } from "../init";

export const payrollRouter = createTRPCRouter({
  getDashboard: protectedProcedure.query(async ({ ctx: { db, teamId } }) => {
    return getPayrollDashboardForTeam({
      db,
      teamId: teamId!,
    });
  }),

  listRuns: protectedProcedure.query(async ({ ctx: { db, teamId } }) => {
    return listPayrollRuns(db, {
      teamId: teamId!,
    });
  }),

  importRun: protectedProcedure
    .input(importPayrollRunSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      return importPayrollRun(db, {
        teamId: teamId!,
        createdBy: session.user.id,
        ...input,
      });
    }),

  generateExport: protectedProcedure
    .input(generatePayrollExportSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return generatePayrollExport(db, {
        teamId: teamId!,
        periodKey: input?.periodKey,
      });
    }),
});
