import {
  getCashBalance,
  getCashFlow,
  getCustomerLifetimeValue,
  getGrowthRate,
  getNetPosition,
  getOutstandingInvoices,
  getOverdueInvoicesAlert,
  getProfitMargin,
  getRecurringExpenses,
  getRunway,
  getSpending,
  getSpendingForPeriod,
  getTaxSummary,
  getTopRevenueClient,
} from "@tamias/app-data/queries";
import {
  getCashFlowWidgetData,
  getGrowthRateWidgetData,
  getRevenueSummaryWidgetData,
} from "@tamias/app-services/widgets";
import {
  getAccountBalancesSchema,
  getCashFlowSchema,
  getCategoryExpensesSchema,
  getCustomerLifetimeValueSchema,
  getGrowthRateSchema,
  getMonthlySpendingSchema,
  getNetPositionSchema,
  getOutstandingInvoicesSchema,
  getOverdueInvoicesAlertSchema,
  getProfitMarginSchema,
  getRecurringExpensesSchema,
  getRevenueSummarySchema,
  getRunwaySchema,
  getTaxSummarySchema,
} from "../../schemas/widgets";
import { protectedProcedure } from "../init";

export const widgetFinanceProcedures = {
  getRunway: protectedProcedure
    .input(getRunwaySchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const runway = await getRunway(db, {
        teamId: teamId!,
        currency: input.currency,
      });

      return {
        result: runway,
        toolCall: {
          toolName: "getBurnRateAnalysis",
          toolParams: {
            currency: input.currency,
          },
        },
      };
    }),

  getTopCustomer: protectedProcedure.query(async ({ ctx: { db, teamId } }) => {
    const topCustomer = await getTopRevenueClient(db, {
      teamId: teamId!,
    });

    return {
      result: topCustomer,
    };
  }),

  getRevenueSummary: protectedProcedure
    .input(getRevenueSummarySchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      return getRevenueSummaryWidgetData({
        db,
        teamId: teamId!,
        input,
      });
    }),

  getGrowthRate: protectedProcedure
    .input(getGrowthRateSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      if (input.type === "revenue" && input.period === "quarterly") {
        return getGrowthRateWidgetData({
          db,
          teamId: teamId!,
          input,
        });
      }

      const growthData = await getGrowthRate(db, {
        teamId: teamId!,
        from: input.from,
        to: input.to,
        currency: input.currency,
        type: input.type,
        revenueType: input.revenueType,
        period: input.period,
      });

      return {
        result: {
          currentTotal: growthData.summary.currentTotal,
          prevTotal: growthData.summary.previousTotal,
          growthRate: growthData.summary.growthRate,
          quarterlyGrowthRate: growthData.summary.periodGrowthRate,
          currency: growthData.summary.currency,
          type: growthData.summary.type,
          revenueType: growthData.summary.revenueType,
          period: growthData.summary.period,
          trend: growthData.summary.trend,
          meta: growthData.meta,
        },
      };
    }),

  getProfitMargin: protectedProcedure
    .input(getProfitMarginSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const profitMarginData = await getProfitMargin(db, {
        teamId: teamId!,
        from: input.from,
        to: input.to,
        currency: input.currency,
        revenueType: input.revenueType,
      });

      return {
        result: {
          totalRevenue: profitMarginData.summary.totalRevenue,
          totalProfit: profitMarginData.summary.totalProfit,
          profitMargin: profitMarginData.summary.profitMargin,
          averageMargin: profitMarginData.summary.averageMargin,
          currency: profitMarginData.summary.currency,
          revenueType: profitMarginData.summary.revenueType,
          trend: profitMarginData.summary.trend,
          monthCount: profitMarginData.summary.monthCount,
          monthlyData: profitMarginData.result,
          meta: profitMarginData.meta,
        },
      };
    }),

  getCashFlow: protectedProcedure
    .input(getCashFlowSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      if (input.period === "monthly") {
        return getCashFlowWidgetData({
          db,
          teamId: teamId!,
          input,
        });
      }

      const cashFlowData = await getCashFlow(db, {
        teamId: teamId!,
        from: input.from,
        to: input.to,
        currency: input.currency,
        period: input.period,
      });

      return {
        result: {
          netCashFlow: cashFlowData.summary.netCashFlow,
          currency: cashFlowData.summary.currency,
          period: cashFlowData.summary.period,
          meta: cashFlowData.meta,
        },
      };
    }),

  getOutstandingInvoices: protectedProcedure
    .input(getOutstandingInvoicesSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const invoicesData = await getOutstandingInvoices(db, {
        teamId: teamId!,
        currency: input.currency,
        status: input.status,
      });

      return {
        result: {
          count: invoicesData.summary.count,
          totalAmount: invoicesData.summary.totalAmount,
          currency: invoicesData.summary.currency,
          status: invoicesData.summary.status,
          meta: invoicesData.meta,
        },
      };
    }),

  getAccountBalances: protectedProcedure
    .input(getAccountBalancesSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const accountBalances = await getCashBalance(db, {
        teamId: teamId!,
        currency: input.currency,
      });

      return {
        result: accountBalances,
      };
    }),

  getNetPosition: protectedProcedure
    .input(getNetPositionSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const netPosition = await getNetPosition(db, {
        teamId: teamId!,
        currency: input.currency,
      });

      return {
        result: netPosition,
      };
    }),

  getMonthlySpending: protectedProcedure
    .input(getMonthlySpendingSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const spending = await getSpendingForPeriod(db, {
        teamId: teamId!,
        from: input.from,
        to: input.to,
        currency: input.currency,
      });

      return {
        result: spending,
        toolCall: {
          toolName: "getSpendingAnalysis",
          toolParams: {
            from: input.from,
            to: input.to,
            currency: input.currency,
          },
        },
      };
    }),

  getRecurringExpenses: protectedProcedure
    .input(getRecurringExpensesSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const recurringExpenses = await getRecurringExpenses(db, {
        teamId: teamId!,
        from: input.from,
        to: input.to,
        currency: input.currency,
      });

      return {
        result: recurringExpenses,
      };
    }),

  getTaxSummary: protectedProcedure
    .input(getTaxSummarySchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const [paidTaxes, collectedTaxes] = await Promise.all([
        getTaxSummary(db, {
          teamId: teamId!,
          type: "paid",
          from: input.from,
          to: input.to,
          currency: input.currency,
        }),
        getTaxSummary(db, {
          teamId: teamId!,
          type: "collected",
          from: input.from,
          to: input.to,
          currency: input.currency,
        }),
      ]);

      return {
        result: {
          paid: paidTaxes.summary,
          collected: collectedTaxes.summary,
          currency: paidTaxes.summary.currency || input.currency || "USD",
        },
      };
    }),

  getCategoryExpenses: protectedProcedure
    .input(getCategoryExpensesSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const categoryExpenses = await getSpending(db, {
        teamId: teamId!,
        from: input.from,
        to: input.to,
        currency: input.currency,
      });

      const topCategories = categoryExpenses
        .sort((a, b) => b.amount - a.amount)
        .slice(0, input.limit || 5);

      const totalAmount = topCategories.reduce((sum, cat) => sum + cat.amount, 0);

      return {
        result: {
          categories: topCategories,
          totalAmount,
          currency: topCategories[0]?.currency || input.currency || "USD",
          totalCategories: categoryExpenses.length,
        },
      };
    }),

  getOverdueInvoicesAlert: protectedProcedure
    .input(getOverdueInvoicesAlertSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const overdueData = await getOverdueInvoicesAlert(db, {
        teamId: teamId!,
        currency: input?.currency,
      });

      return {
        result: overdueData.summary,
      };
    }),

  getCustomerLifetimeValue: protectedProcedure
    .input(getCustomerLifetimeValueSchema)
    .query(async ({ ctx: { db, teamId }, input }) => {
      const result = await getCustomerLifetimeValue(db, {
        teamId: teamId!,
        currency: input.currency,
      });

      return {
        result,
        toolCall: {
          toolName: "getCustomerLifetimeValue",
          toolParams: {
            currency: input.currency,
          },
        },
      };
    }),
};
