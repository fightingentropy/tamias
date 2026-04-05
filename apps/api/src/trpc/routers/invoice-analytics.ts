import {
  getAverageDaysToPayment,
  getAverageInvoiceSize,
} from "@tamias/app-data/queries";
import { getCustomerPageSummaryForTeam } from "@tamias/app-services/customers";
import { protectedProcedure } from "../init";

export const invoiceAnalyticsProcedures = {
  mostActiveClient: protectedProcedure.query(
    async ({ ctx: { db, teamId } }) => {
      return (await getCustomerPageSummaryForTeam({
        db,
        teamId: teamId!,
      })).mostActiveClient;
    },
  ),

  inactiveClientsCount: protectedProcedure.query(
    async ({ ctx: { db, teamId } }) => {
      return (await getCustomerPageSummaryForTeam({
        db,
        teamId: teamId!,
      })).inactiveClientsCount;
    },
  ),

  averageDaysToPayment: protectedProcedure.query(
    async ({ ctx: { db, teamId } }) => {
      return getAverageDaysToPayment(db, { teamId: teamId! });
    },
  ),

  averageInvoiceSize: protectedProcedure.query(
    async ({ ctx: { db, teamId } }) => {
      return getAverageInvoiceSize(db, { teamId: teamId! });
    },
  ),

  topRevenueClient: protectedProcedure.query(
    async ({ ctx: { db, teamId } }) => {
      return (await getCustomerPageSummaryForTeam({
        db,
        teamId: teamId!,
      })).topRevenueClient;
    },
  ),

  newCustomersCount: protectedProcedure.query(
    async ({ ctx: { db, teamId } }) => {
      return (await getCustomerPageSummaryForTeam({
        db,
        teamId: teamId!,
      })).newCustomersCount;
    },
  ),
};
