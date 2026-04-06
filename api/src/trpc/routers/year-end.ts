import {
  deleteCloseCompanyLoansSchedule,
  deleteCorporationTaxAdjustment,
  deleteCorporationTaxRateSchedule,
  deleteYearEndManualJournal,
  generateYearEndExport,
  getYearEndPack,
  listAccountsSubmissionEvents,
  listCtSubmissionEvents,
  pollAnnualAccountsSubmission,
  pollCt600Submission,
  rebuildYearEndPack,
  submitAnnualAccountsToCompaniesHouse,
  submitCt600ToHmrc,
  upsertCloseCompanyLoansSchedule,
  upsertCorporationTaxAdjustment,
  upsertCorporationTaxRateSchedule,
  upsertYearEndManualJournal,
} from "@tamias/app-data/queries";
import { getYearEndDashboardForTeam } from "@tamias/app-services/compliance";
import {
  deleteCloseCompanyLoansScheduleSchema,
  deleteCorporationTaxAdjustmentSchema,
  deleteCorporationTaxRateScheduleSchema,
  deleteYearEndManualJournalSchema,
  generateYearEndExportSchema,
  getYearEndPackSchema,
  listYearEndAccountsSubmissionsSchema,
  listYearEndCtSubmissionsSchema,
  pollYearEndAccountsSchema,
  pollYearEndCt600Schema,
  rebuildYearEndPackSchema,
  submitYearEndAccountsSchema,
  submitYearEndCt600Schema,
  upsertCloseCompanyLoansScheduleSchema,
  upsertCorporationTaxAdjustmentSchema,
  upsertCorporationTaxRateScheduleSchema,
  upsertYearEndManualJournalSchema,
} from "../../schemas/compliance";
import { createTRPCRouter, protectedProcedure } from "../init";

export const yearEndRouter = createTRPCRouter({
  getDashboard: protectedProcedure.query(async ({ ctx: { db, teamId } }) => {
    return getYearEndDashboardForTeam({
      db,
      teamId: teamId!,
    });
  }),

  getPack: protectedProcedure
    .input(getYearEndPackSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return getYearEndPack(db, {
        teamId: teamId!,
        periodKey: input?.periodKey,
      });
    }),

  listSubmissions: protectedProcedure
    .input(listYearEndCtSubmissionsSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return listCtSubmissionEvents(db, {
        teamId: teamId!,
        periodKey: input?.periodKey,
      });
    }),

  listAccountsSubmissions: protectedProcedure
    .input(listYearEndAccountsSubmissionsSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return listAccountsSubmissionEvents(db, {
        teamId: teamId!,
        periodKey: input?.periodKey,
      });
    }),

  rebuildPack: protectedProcedure
    .input(rebuildYearEndPackSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return rebuildYearEndPack(db, {
        teamId: teamId!,
        periodKey: input?.periodKey,
      });
    }),

  upsertManualJournal: protectedProcedure
    .input(upsertYearEndManualJournalSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      return upsertYearEndManualJournal(db, {
        teamId: teamId!,
        createdBy: session.user.id,
        ...input,
      });
    }),

  deleteManualJournal: protectedProcedure
    .input(deleteYearEndManualJournalSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return deleteYearEndManualJournal(db, {
        teamId: teamId!,
        journalId: input.journalId,
        periodKey: input.periodKey,
      });
    }),

  upsertCorporationTaxAdjustment: protectedProcedure
    .input(upsertCorporationTaxAdjustmentSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      return upsertCorporationTaxAdjustment(db, {
        teamId: teamId!,
        createdBy: session.user.id,
        ...input,
      });
    }),

  deleteCorporationTaxAdjustment: protectedProcedure
    .input(deleteCorporationTaxAdjustmentSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return deleteCorporationTaxAdjustment(db, {
        teamId: teamId!,
        adjustmentId: input.adjustmentId,
        periodKey: input.periodKey,
      });
    }),

  upsertCloseCompanyLoansSchedule: protectedProcedure
    .input(upsertCloseCompanyLoansScheduleSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      return upsertCloseCompanyLoansSchedule(db, {
        teamId: teamId!,
        createdBy: session.user.id,
        ...input,
      });
    }),

  deleteCloseCompanyLoansSchedule: protectedProcedure
    .input(deleteCloseCompanyLoansScheduleSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return deleteCloseCompanyLoansSchedule(db, {
        teamId: teamId!,
        periodKey: input.periodKey,
      });
    }),

  upsertCorporationTaxRateSchedule: protectedProcedure
    .input(upsertCorporationTaxRateScheduleSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      return upsertCorporationTaxRateSchedule(db, {
        teamId: teamId!,
        createdBy: session.user.id,
        ...input,
      });
    }),

  deleteCorporationTaxRateSchedule: protectedProcedure
    .input(deleteCorporationTaxRateScheduleSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return deleteCorporationTaxRateSchedule(db, {
        teamId: teamId!,
        periodKey: input.periodKey,
      });
    }),

  generateExport: protectedProcedure
    .input(generateYearEndExportSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return generateYearEndExport(db, {
        teamId: teamId!,
        periodKey: input?.periodKey,
      });
    }),

  submitCt600: protectedProcedure
    .input(submitYearEndCt600Schema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      return submitCt600ToHmrc(db, {
        teamId: teamId!,
        submittedBy: session.user.id,
        periodKey: input.periodKey,
        declarationAccepted: input.declarationAccepted,
      });
    }),

  submitAccounts: protectedProcedure
    .input(submitYearEndAccountsSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      return submitAnnualAccountsToCompaniesHouse(db, {
        teamId: teamId!,
        submittedBy: session.user.id,
        periodKey: input.periodKey,
        declarationAccepted: input.declarationAccepted,
      });
    }),

  pollCt600: protectedProcedure
    .input(pollYearEndCt600Schema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return pollCt600Submission(db, {
        teamId: teamId!,
        periodKey: input?.periodKey,
        correlationId: input?.correlationId,
        responseEndpoint: input?.responseEndpoint,
      });
    }),

  pollAccounts: protectedProcedure
    .input(pollYearEndAccountsSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return pollAnnualAccountsSubmission(db, {
        teamId: teamId!,
        periodKey: input?.periodKey,
        submissionNumber: input?.submissionNumber,
      });
    }),
});
