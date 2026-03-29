import {
  closeCompaniesHouseTransactionSchema,
  createCompaniesHouseRegisteredEmailAddressDraftSchema,
  createCompaniesHouseRegisteredOfficeAddressDraftSchema,
  createCompaniesHouseTransactionSchema,
  deleteCompaniesHouseTransactionSchema,
  refreshCompaniesHouseRegisteredEmailAddressDraftSchema,
  refreshCompaniesHouseRegisteredOfficeAddressDraftSchema,
  getCompaniesHouseTransactionSchema,
  submitCompaniesHousePscDiscrepancyReportSchema,
} from "../../schemas/companies-house";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  getCompaniesHouseAccountsStatus,
  createCompaniesHouseRegisteredEmailAddressDraft,
  createCompaniesHouseRegisteredOfficeAddressDraft,
  closeCompaniesHouseTransaction,
  createCompaniesHouseTransaction,
  deleteCompaniesHouseTransaction,
  getCompaniesHouseConnection,
  getCompaniesHouseTransaction,
  refreshCompaniesHouseRegisteredEmailAddressDraft,
  refreshCompaniesHouseRegisteredOfficeAddressDraft,
  submitCompaniesHousePscDiscrepancyReport,
} from "@tamias/app-data/queries";

export const companiesHouseRouter = createTRPCRouter({
  getConnection: protectedProcedure.query(async ({ ctx: { db, teamId } }) => {
    return getCompaniesHouseConnection(db, {
      teamId: teamId!,
    });
  }),

  getAccountsStatus: protectedProcedure.query(async ({ ctx: { db, teamId } }) => {
    return getCompaniesHouseAccountsStatus(db, {
      teamId: teamId!,
    });
  }),

  createRegisteredOfficeAddressDraft: protectedProcedure
    .input(createCompaniesHouseRegisteredOfficeAddressDraftSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return createCompaniesHouseRegisteredOfficeAddressDraft(db, {
        teamId: teamId!,
        ...input,
      });
    }),

  refreshRegisteredOfficeAddressDraft: protectedProcedure
    .input(refreshCompaniesHouseRegisteredOfficeAddressDraftSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return refreshCompaniesHouseRegisteredOfficeAddressDraft(db, {
        teamId: teamId!,
        transactionId: input.transactionId,
      });
    }),

  createRegisteredEmailAddressDraft: protectedProcedure
    .input(createCompaniesHouseRegisteredEmailAddressDraftSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return createCompaniesHouseRegisteredEmailAddressDraft(db, {
        teamId: teamId!,
        ...input,
      });
    }),

  refreshRegisteredEmailAddressDraft: protectedProcedure
    .input(refreshCompaniesHouseRegisteredEmailAddressDraftSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return refreshCompaniesHouseRegisteredEmailAddressDraft(db, {
        teamId: teamId!,
        transactionId: input.transactionId,
      });
    }),

  submitPscDiscrepancyReport: protectedProcedure
    .input(submitCompaniesHousePscDiscrepancyReportSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return submitCompaniesHousePscDiscrepancyReport(db, {
        teamId: teamId!,
        ...input,
      });
    }),

  createTransaction: protectedProcedure
    .input(createCompaniesHouseTransactionSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return createCompaniesHouseTransaction(db, {
        teamId: teamId!,
        ...input,
      });
    }),

  getTransaction: protectedProcedure
    .input(getCompaniesHouseTransactionSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return getCompaniesHouseTransaction(db, {
        teamId: teamId!,
        transactionId: input.transactionId,
      });
    }),

  closeTransaction: protectedProcedure
    .input(closeCompaniesHouseTransactionSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return closeCompaniesHouseTransaction(db, {
        teamId: teamId!,
        transactionId: input.transactionId,
      });
    }),

  deleteTransaction: protectedProcedure
    .input(deleteCompaniesHouseTransactionSchema)
    .mutation(async ({ ctx: { db, teamId }, input }) => {
      return deleteCompaniesHouseTransaction(db, {
        teamId: teamId!,
        transactionId: input.transactionId,
      });
    }),
});
