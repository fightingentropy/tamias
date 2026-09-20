import {
  addVatAdjustment,
  getEvidencePack,
  getVatDraft,
  listVatObligations,
  recalculateVatDraft,
  submitVatReturn,
} from "@tamias/app-data/queries";
import { getVatDashboardForTeam, getVatSubmissionsForTeam } from "@tamias/app-services/compliance";
import {
  addVatAdjustmentSchema,
  getEvidencePackSchema,
  getVatDraftSchema,
  recalculateVatDraftSchema,
  submitVatReturnSchema,
} from "../../schemas/compliance";
import { createTRPCRouter, protectedProcedure } from "../init";

export const vatRouter = createTRPCRouter({
  getDashboard: protectedProcedure.query(async ({ ctx: { db, teamId, hmrcFraudContext } }) => {
    return getVatDashboardForTeam({
      db,
      teamId: teamId!,
      fraudContext: hmrcFraudContext,
    });
  }),

  listObligations: protectedProcedure.query(async ({ ctx: { db, teamId, hmrcFraudContext } }) => {
    return listVatObligations(db, { teamId: teamId!, fraudContext: hmrcFraudContext });
  }),

  getDraft: protectedProcedure
    .input(getVatDraftSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return getVatDraft(db, { teamId: teamId!, ...input });
    }),

  recalculateDraft: protectedProcedure
    .input(recalculateVatDraftSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return recalculateVatDraft(db, { teamId: teamId!, ...input });
    }),

  addAdjustment: protectedProcedure
    .input(addVatAdjustmentSchema)
    .mutation(async ({ ctx: { db, teamId, session }, input }) => {
      return addVatAdjustment(db, {
        teamId: teamId!,
        createdBy: session.user.id,
        ...input,
      });
    }),

  submit: protectedProcedure
    .input(submitVatReturnSchema)
    .mutation(async ({ ctx: { db, teamId, session, hmrcFraudContext }, input }) => {
      return submitVatReturn(db, {
        teamId: teamId!,
        submittedBy: session.user.id,
        fraudContext: hmrcFraudContext,
        ...input,
      });
    }),

  listSubmissions: protectedProcedure.query(async ({ ctx: { db, teamId } }) =>
    getVatSubmissionsForTeam({
      db,
      teamId: teamId!,
    }),
  ),

  getEvidencePack: protectedProcedure
    .input(getEvidencePackSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return getEvidencePack(db, { teamId: teamId!, ...input });
    }),
});
