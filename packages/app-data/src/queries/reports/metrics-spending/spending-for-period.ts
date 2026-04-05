import type { Database } from "../../../client";
import { reuseQueryResult } from "../../../utils/request-cache";
import { serializeMetricRangeParams } from "../metrics-common";
import { getExpenses } from "./expenses";
import { getSpending } from "./spending";

export type GetSpendingForPeriodParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
  exactDates?: boolean;
};

async function getSpendingForPeriodImpl(
  db: Database,
  params: GetSpendingForPeriodParams,
) {
  const expensesData = await getExpenses(db, params);
  const totalSpending = expensesData.result.reduce(
    (sum, item) => sum + item.total,
    0,
  );
  const currency = expensesData.meta.currency || params.currency || "USD";
  const spendingCategories = await getSpending(db, params);
  const topCategory = spendingCategories[0] || null;

  return {
    totalSpending: Math.round(totalSpending * 100) / 100,
    currency,
    topCategory: topCategory
      ? {
          name: topCategory.name,
          amount:
            Math.round(((totalSpending * topCategory.percentage) / 100) * 100) /
            100,
          percentage: topCategory.percentage,
        }
      : null,
  };
}

export const getSpendingForPeriod = reuseQueryResult({
  keyPrefix: "spending-for-period",
  keyFn: serializeMetricRangeParams,
  load: getSpendingForPeriodImpl,
});
