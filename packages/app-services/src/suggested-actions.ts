import { api } from "@tamias/convex-model/api";
import type { Id } from "@tamias/convex-model/data-model";
import { getConvexServiceKey, getSharedConvexClient } from "./convex-client";

function serviceArgs<T extends Record<string, unknown>>(args: T) {
  return {
    serviceKey: getConvexServiceKey(),
    ...args,
  };
}

export async function getSuggestedActionUsageFromConvex(args: {
  userId: Id<"appUsers">;
  teamId: string;
}) {
  return getSharedConvexClient().query(
    api.suggestedActions.serviceGetSuggestedActionUsage,
    serviceArgs(args),
  );
}

export async function incrementSuggestedActionUsageInConvex(args: {
  userId: Id<"appUsers">;
  teamId: string;
  actionId: string;
}) {
  return getSharedConvexClient().mutation(
    api.suggestedActions.serviceIncrementSuggestedActionUsage,
    serviceArgs(args),
  );
}

export const SUGGESTED_ACTIONS_CONFIG = [
  {
    id: "get-burn-rate-analysis",
    toolName: "getBurnRate",
    toolParams: {
      showCanvas: true,
    },
  },
  {
    id: "latest-transactions",
    toolName: "getTransactions",
    toolParams: {
      pageSize: 10,
      sort: ["date", "desc"],
    },
  },
  {
    id: "expenses-breakdown",
    toolName: "getExpensesBreakdown",
    toolParams: {
      showCanvas: true,
    },
  },
  {
    id: "balance-sheet",
    toolName: "getBalanceSheet",
    toolParams: {
      showCanvas: true,
    },
  },
  {
    id: "get-spending",
    toolName: "getSpending",
    toolParams: {
      showCanvas: true,
    },
  },
  {
    id: "get-runway",
    toolName: "getRunway",
    toolParams: {
      showCanvas: true,
    },
  },
  {
    id: "get-cash-flow",
    toolName: "getCashFlow",
    toolParams: {
      showCanvas: true,
    },
  },
  {
    id: "get-revenue-summary",
    toolName: "getRevenueSummary",
    toolParams: {
      showCanvas: true,
    },
  },
  {
    id: "get-account-balances",
    toolName: "getAccountBalances",
    toolParams: {},
  },
  {
    id: "get-invoices",
    toolName: "getInvoices",
    toolParams: {
      pageSize: 10,
      sort: ["createdAt", "desc"],
    },
  },
  {
    id: "get-customers",
    toolName: "getCustomers",
    toolParams: {
      pageSize: 10,
    },
  },
  {
    id: "get-profit-analysis",
    toolName: "getProfitAnalysis",
    toolParams: {
      showCanvas: true,
    },
  },
  {
    id: "get-invoice-payment-analysis",
    toolName: "getInvoicePaymentAnalysis",
    toolParams: {
      showCanvas: true,
    },
  },
  {
    id: "get-tax-summary",
    toolName: "getTaxSummary",
    toolParams: {
      showCanvas: true,
    },
  },
  {
    id: "get-business-health-score",
    toolName: "getBusinessHealthScore",
    toolParams: {
      showCanvas: true,
    },
  },
  {
    id: "get-forecast",
    toolName: "getForecast",
    toolParams: {
      showCanvas: true,
    },
  },
  {
    id: "get-cash-flow-stress-test",
    toolName: "getCashFlowStressTest",
    toolParams: {
      showCanvas: true,
    },
  },
  {
    id: "get-expenses",
    toolName: "getExpenses",
    toolParams: {
      showCanvas: true,
    },
  },
  {
    id: "get-growth-rate",
    toolName: "getGrowthRate",
    toolParams: {
      showCanvas: true,
    },
  },
] as const;

type SuggestedActionUsageMap = Readonly<
  Record<
    string,
    | {
        count: number;
        lastUsed: Date | string | null;
      }
    | undefined
  >
>;

export function buildSuggestedActionsList({
  allUsage,
  limit,
}: {
  allUsage: SuggestedActionUsageMap;
  limit: number;
}) {
  const actions = SUGGESTED_ACTIONS_CONFIG.map((action) => {
    const usage = allUsage[action.id];

    return {
      id: action.id,
      toolName: action.toolName,
      toolParams: action.toolParams,
      usageCount: usage?.count || 0,
      lastUsed: usage?.lastUsed ? new Date(usage.lastUsed) : null,
    };
  })
    .sort((left, right) => {
      if (left.usageCount !== right.usageCount) {
        return right.usageCount - left.usageCount;
      }

      if (left.lastUsed && right.lastUsed) {
        return right.lastUsed.getTime() - left.lastUsed.getTime();
      }

      if (left.lastUsed && !right.lastUsed) return -1;
      if (!left.lastUsed && right.lastUsed) return 1;

      return 0;
    })
    .slice(0, limit);

  return {
    actions,
    total: SUGGESTED_ACTIONS_CONFIG.length,
  };
}
