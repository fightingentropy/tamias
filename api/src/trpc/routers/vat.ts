import {
  addVatAdjustment,
  getEvidencePack,
  getVatDraft,
  listVatObligations,
  recalculateVatDraft,
  submitVatReturn,
} from "@tamias/app-data/queries";
import {
  getVatDashboardForTeam,
  getVatSubmissionsForTeam,
} from "@tamias/app-services/compliance";
import {
  addVatAdjustmentSchema,
  getEvidencePackSchema,
  getVatDraftSchema,
  recalculateVatDraftSchema,
  submitVatReturnSchema,
} from "../../schemas/compliance";
import { createTRPCRouter, protectedProcedure } from "../init";

export const vatRouter = createTRPCRouter({
  getDashboard: protectedProcedure.query(async ({ ctx: { db, teamId } }) => {
    return getVatDashboardForTeam({
      db,
      teamId: teamId!,
    });
  }),

  listObligations: protectedProcedure.query(async ({ ctx: { db, teamId } }) => {
    return listVatObligations(db, { teamId: teamId! });
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
    .mutation(async ({ ctx: { db, teamId, session, geo }, input }) => {
      return submitVatReturn(db, {
        teamId: teamId!,
        submittedBy: session.user.id,
        publicIp: geo.ip ?? input.publicIp,
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
    .query(async ({ ctx: { teamId }, input }) => {
      return getEvidencePack({ teamId: teamId!, ...input });
    }),
});
