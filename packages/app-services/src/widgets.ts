import type { Database } from "@tamias/app-data/client";
import { api } from "@tamias/app-data-convex/api";
import type { Id } from "@tamias/app-data-convex/data-model";
import {
  getBillableHours,
  getCashBalance,
  getCashFlow,
  getCustomerLifetimeValue,
  getGrowthRate,
  getInboxStats,
  getNetPosition,
  getOutstandingInvoices,
  getOverdueInvoicesAlert,
  getProfitMargin,
  getRecentDocuments,
  getRecurringExpenses,
  getReports,
  getRevenueForecast,
  getRunway,
  getSpending,
  getSpendingForPeriod,
  getTaxSummary,
  getTopRevenueClient,
  getTrackedTime,
} from "@tamias/app-data/queries";
import { getPaymentStatus } from "@tamias/app-data/queries/invoices";
import type { WidgetType } from "@tamias/domain";
import { createConvexClient, getConvexServiceKey, getSharedConvexClient } from "./convex-client";

function serviceArgs<T extends Record<string, unknown>>(args: T) {
  return {
    serviceKey: getConvexServiceKey(),
    ...args,
  };
}

const OVERVIEW_TRANSACTION_WIDGETS = new Set<WidgetType>([
  "runway",
  "cash-flow",
  "account-balances",
  "profit-analysis",
  "revenue-forecast",
  "revenue-summary",
  "growth-rate",
]);
const HYDRATABLE_STANDALONE_WIDGETS = new Set<WidgetType>([
  "top-customer",
  "outstanding-invoices",
  "overdue-invoices-alert",
  "net-position",
  "monthly-spending",
  "recurring-expenses",
  "category-expenses",
  "profit-margin",
  "tax-summary",
  "vault",
  "customer-lifetime-value",
]);
const CONTEXTUAL_HYDRATABLE_WIDGETS = new Set<WidgetType>([
  "inbox",
  "time-tracker",
  "billable-hours",
  "invoice-payment-score",
]);

export function isOverviewWidgetType(widget: WidgetType): boolean {
  return OVERVIEW_TRANSACTION_WIDGETS.has(widget);
}

export function isHydratableStandaloneWidgetType(widget: WidgetType): boolean {
  return HYDRATABLE_STANDALONE_WIDGETS.has(widget);
}

export function isContextualHydratableWidgetType(widget: WidgetType): boolean {
  return CONTEXTUAL_HYDRATABLE_WIDGETS.has(widget);
}

export async function getRevenueSummaryWidgetData(args: {
  db: Database;
  teamId: string;
  input: {
    from: string;
    to: string;
    currency?: string;
    revenueType: "gross" | "net";
  };
}) {
  const result = await getReports(args.db, {
    teamId: args.teamId,
    from: args.input.from,
    to: args.input.to,
    currency: args.input.currency,
    type: "revenue",
    revenueType: args.input.revenueType,
  });

  return {
    result: {
      totalRevenue: result.summary.currentTotal,
      currency: result.summary.currency,
      revenueType: args.input.revenueType,
      monthCount: result.result.length,
    },
  };
}

export async function getGrowthRateWidgetData(args: {
  db: Database;
  teamId: string;
  input: {
    from: string;
    to: string;
    currency?: string;
    revenueType: "gross" | "net";
  };
}) {
  const growthData = await getGrowthRate(args.db, {
    teamId: args.teamId,
    from: args.input.from,
    to: args.input.to,
    currency: args.input.currency,
    type: "revenue",
    revenueType: args.input.revenueType,
    period: "quarterly",
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
}

export async function getCashFlowWidgetData(args: {
  db: Database;
  teamId: string;
  input: {
    from: string;
    to: string;
    currency?: string;
  };
}) {
  const cashFlowData = await getCashFlow(args.db, {
    teamId: args.teamId,
    from: args.input.from,
    to: args.input.to,
    currency: args.input.currency,
    period: "monthly",
  });

  return {
    result: {
      netCashFlow: cashFlowData.summary.netCashFlow,
      currency: cashFlowData.summary.currency,
      period: cashFlowData.summary.period,
      meta: cashFlowData.meta,
    },
  };
}

export async function getOverviewWidgetsData(args: {
  db: Database;
  teamId: string;
  widgets: WidgetType[];
  from: string;
  to: string;
  currency?: string;
  revenueType: "gross" | "net";
}) {
  const requestedWidgets = new Set<WidgetType>(args.widgets);
  const overviewTasks: Array<Promise<readonly [WidgetType, unknown]>> = [];

  if (requestedWidgets.has("runway")) {
    overviewTasks.push(
      (async () =>
        [
          "runway",
          {
            result: await getRunway(args.db, {
              teamId: args.teamId,
              currency: args.currency,
            }),
            toolCall: {
              toolName: "getBurnRateAnalysis",
              toolParams: {
                currency: args.currency,
              },
            },
          },
        ] as const)(),
    );
  }

  if (requestedWidgets.has("cash-flow")) {
    overviewTasks.push(
      (async () =>
        [
          "cash-flow",
          await getCashFlowWidgetData({
            db: args.db,
            teamId: args.teamId,
            input: args,
          }),
        ] as const)(),
    );
  }

  if (requestedWidgets.has("account-balances")) {
    overviewTasks.push(
      (async () =>
        [
          "account-balances",
          {
            result: await getCashBalance(args.db, {
              teamId: args.teamId,
              currency: args.currency,
            }),
          },
        ] as const)(),
    );
  }

  if (requestedWidgets.has("profit-analysis")) {
    overviewTasks.push(
      (async () =>
        [
          "profit-analysis",
          await getReports(args.db, {
            teamId: args.teamId,
            from: args.from,
            to: args.to,
            currency: args.currency,
            type: "profit",
            revenueType: args.revenueType,
          }),
        ] as const)(),
    );
  }

  if (requestedWidgets.has("revenue-forecast")) {
    overviewTasks.push(
      (async () =>
        [
          "revenue-forecast",
          await getRevenueForecast(args.db, {
            teamId: args.teamId,
            from: args.from,
            to: args.to,
            forecastMonths: 6,
            currency: args.currency,
            revenueType: args.revenueType,
          }),
        ] as const)(),
    );
  }

  if (requestedWidgets.has("revenue-summary")) {
    overviewTasks.push(
      (async () =>
        [
          "revenue-summary",
          await getRevenueSummaryWidgetData({
            db: args.db,
            teamId: args.teamId,
            input: args,
          }),
        ] as const)(),
    );
  }

  if (requestedWidgets.has("growth-rate")) {
    overviewTasks.push(
      (async () =>
        [
          "growth-rate",
          await getGrowthRateWidgetData({
            db: args.db,
            teamId: args.teamId,
            input: args,
          }),
        ] as const)(),
    );
  }

  return Object.fromEntries(await Promise.all(overviewTasks));
}

export async function getHydratableStandaloneWidgetData(args: {
  db: Database;
  teamId: string;
  widget: WidgetType;
  from: string;
  to: string;
  currency?: string;
  revenueType: "gross" | "net";
}) {
  switch (args.widget) {
    case "top-customer":
      return {
        result: await getTopRevenueClient(args.db, {
          teamId: args.teamId,
        }),
      };
    case "outstanding-invoices": {
      const invoicesData = await getOutstandingInvoices(args.db, {
        teamId: args.teamId,
        currency: args.currency,
        status: ["unpaid", "overdue"],
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
    }
    case "overdue-invoices-alert": {
      const overdueData = await getOverdueInvoicesAlert(args.db, {
        teamId: args.teamId,
      });

      return {
        result: overdueData.summary,
      };
    }
    case "net-position":
      return {
        result: await getNetPosition(args.db, {
          teamId: args.teamId,
          currency: args.currency,
        }),
      };
    case "monthly-spending": {
      const spending = await getSpendingForPeriod(args.db, {
        teamId: args.teamId,
        from: args.from,
        to: args.to,
      });

      return {
        result: spending,
        toolCall: {
          toolName: "getSpendingAnalysis",
          toolParams: {
            from: args.from,
            to: args.to,
          },
        },
      };
    }
    case "recurring-expenses":
      return {
        result: await getRecurringExpenses(args.db, {
          teamId: args.teamId,
          from: args.from,
          to: args.to,
        }),
      };
    case "category-expenses": {
      const categoryExpenses = await getSpending(args.db, {
        teamId: args.teamId,
        from: args.from,
        to: args.to,
      });
      const topCategories = categoryExpenses.sort((a, b) => b.amount - a.amount).slice(0, 3);
      const totalAmount = topCategories.reduce((sum, category) => sum + category.amount, 0);

      return {
        result: {
          categories: topCategories,
          totalAmount,
          currency: topCategories[0]?.currency || "USD",
          totalCategories: categoryExpenses.length,
        },
      };
    }
    case "profit-margin": {
      const profitMarginData = await getProfitMargin(args.db, {
        teamId: args.teamId,
        from: args.from,
        to: args.to,
        currency: args.currency,
        revenueType: args.revenueType,
      });

      return {
        result: {
          totalRevenue: profitMarginData.summary.totalRevenue,
          totalProfit: profitMarginData.summary.totalProfit,
          profitMargin: profitMarginData.summary.profitMargin,
          averageMargin: profitMarginData.summary.averageMargin,
          currency: profitMarginData.summary.currency,
          revenueType: args.revenueType,
          trend: profitMarginData.summary.trend,
          monthCount: profitMarginData.summary.monthCount,
          monthlyData: profitMarginData.result,
          meta: profitMarginData.meta,
        },
      };
    }
    case "tax-summary": {
      const [paidTaxes, collectedTaxes] = await Promise.all([
        getTaxSummary(args.db, {
          teamId: args.teamId,
          type: "paid",
          from: args.from,
          to: args.to,
        }),
        getTaxSummary(args.db, {
          teamId: args.teamId,
          type: "collected",
          from: args.from,
          to: args.to,
        }),
      ]);

      return {
        result: {
          paid: paidTaxes.summary,
          collected: collectedTaxes.summary,
          currency: paidTaxes.summary.currency || "USD",
        },
      };
    }
    case "vault":
      return {
        result: await getRecentDocuments(args.db, {
          teamId: args.teamId,
          limit: 3,
        }),
      };
    case "customer-lifetime-value": {
      const result = await getCustomerLifetimeValue(args.db, {
        teamId: args.teamId,
        currency: args.currency,
      });

      return {
        result,
        toolCall: {
          toolName: "getCustomerLifetimeValue",
          toolParams: {
            currency: args.currency,
          },
        },
      };
    }
    default:
      return null;
  }
}

export async function getHydratableStandaloneWidgetsData(args: {
  db: Database;
  teamId: string;
  widgets: WidgetType[];
  from: string;
  to: string;
  currency?: string;
  revenueType: "gross" | "net";
}) {
  const entries = await Promise.all(
    args.widgets.filter(isHydratableStandaloneWidgetType).map(
      async (widget) =>
        [
          widget,
          await getHydratableStandaloneWidgetData({
            ...args,
            widget,
          }),
        ] as const,
    ),
  );

  return Object.fromEntries(entries.flatMap(([widget, data]) => (data ? [[widget, data]] : [])));
}

export async function getContextualHydratableWidgetData(args: {
  db: Database;
  teamId: string;
  widget: WidgetType;
  currency?: string;
  inboxFrom: string;
  inboxTo: string;
  trackedTimeFrom: string;
  trackedTimeTo: string;
  assignedId?: string;
  billableDate: string;
  weekStartsOnMonday: boolean;
}) {
  switch (args.widget) {
    case "inbox": {
      const inboxStats = await getInboxStats(args.db, {
        teamId: args.teamId,
        from: args.inboxFrom,
        to: args.inboxTo,
        currency: args.currency,
      });

      return {
        result: inboxStats.result,
      };
    }
    case "time-tracker":
      return {
        result: await getTrackedTime(args.db, {
          teamId: args.teamId,
          assignedId: args.assignedId as Parameters<typeof getTrackedTime>[1]["assignedId"],
          from: args.trackedTimeFrom,
          to: args.trackedTimeTo,
        }),
      };
    case "billable-hours":
      return getBillableHours(args.db, {
        teamId: args.teamId,
        date: args.billableDate,
        view: "month",
        weekStartsOnMonday: args.weekStartsOnMonday,
      });
    case "invoice-payment-score":
      return getPaymentStatus(args.db, args.teamId);
    default:
      return null;
  }
}

export async function getContextualHydratableWidgetsData(args: {
  db: Database;
  teamId: string;
  widgets: WidgetType[];
  currency?: string;
  inboxFrom: string;
  inboxTo: string;
  trackedTimeFrom: string;
  trackedTimeTo: string;
  assignedId?: string;
  billableDate: string;
  weekStartsOnMonday: boolean;
}) {
  const entries = await Promise.all(
    args.widgets.filter(isContextualHydratableWidgetType).map(
      async (widget) =>
        [
          widget,
          await getContextualHydratableWidgetData({
            ...args,
            widget,
          }),
        ] as const,
    ),
  );

  return Object.fromEntries(entries.flatMap(([widget, data]) => (data ? [[widget, data]] : [])));
}

export async function getWidgetPreferencesFromConvex(args: {
  userId: Id<"appUsers">;
  teamId: string;
}) {
  return getSharedConvexClient().query(api.widgets.serviceGetWidgetPreferences, serviceArgs(args));
}

export async function getWidgetPreferencesFromConvexAsAuthUser(accessToken?: string) {
  if (!accessToken) {
    return null;
  }

  const client = createConvexClient();

  try {
    client.setAuth(accessToken);
    return await client.query(api.widgets.myWidgetPreferences, {});
  } catch {
    return null;
  } finally {
    client.clearAuth();
  }
}

export async function updateWidgetPreferencesInConvex(args: {
  userId: Id<"appUsers">;
  teamId: string;
  primaryWidgets: WidgetType[];
}) {
  return getSharedConvexClient().mutation(
    api.widgets.serviceUpdateWidgetPreferences,
    serviceArgs(args),
  );
}
