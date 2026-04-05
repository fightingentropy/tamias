import { getCategoryColor } from "@tamias/categories";
import type { Database } from "../../../client";
import { reuseQueryResult } from "../../../utils/request-cache";
import { serializeMetricRangeParams } from "../metrics-common";
import {
  getCategoryInfo,
  humanizeCategorySlug,
  roundMoney,
} from "../shared";
import { getMetricAggregateData } from "./common";

export type GetSpendingParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
};

interface SpendingResultItem {
  name: string;
  slug: string;
  amount: number;
  currency: string;
  color: string;
  percentage: number;
}

async function getSpendingImpl(
  db: Database,
  params: GetSpendingParams,
): Promise<SpendingResultItem[]> {
  const aggregateData = await getMetricAggregateData(db, params);
  let totalAmount = 0;
  const categoryTotals = new Map<string, number>();
  let uncategorizedAmount = 0;

  for (const row of aggregateData.rows.filter(
    (aggregateRow) => aggregateRow.direction === "expense",
  )) {
    const slug = row.categorySlug;
    const amount = Math.abs(row.totalAmount);

    if (slug && aggregateData.excludedCategorySlugs.includes(slug)) {
      uncategorizedAmount = roundMoney(uncategorizedAmount + amount);
      continue;
    }

    totalAmount = roundMoney(totalAmount + amount);

    if (!slug) {
      uncategorizedAmount = roundMoney(uncategorizedAmount + amount);
      continue;
    }

    categoryTotals.set(
      slug,
      roundMoney((categoryTotals.get(slug) ?? 0) + amount),
    );
  }

  const categorySpending = [...categoryTotals.entries()].map(
    ([slug, amount]) => {
      const categoryInfo = getCategoryInfo(slug, null);
      const percentage = totalAmount !== 0 ? (amount / totalAmount) * 100 : 0;

      return {
        name: categoryInfo?.name || humanizeCategorySlug(slug),
        slug,
        amount,
        currency: aggregateData.targetCurrency || "USD",
        color: categoryInfo?.color || getCategoryColor(slug),
        percentage:
          percentage > 1
            ? Math.round(percentage)
            : Math.round(percentage * 100) / 100,
      };
    },
  );

  if (uncategorizedAmount > 0) {
    const percentage =
      totalAmount !== 0 ? (uncategorizedAmount / totalAmount) * 100 : 0;

    categorySpending.push({
      name: "Uncategorized",
      slug: "uncategorized",
      amount: uncategorizedAmount,
      currency: aggregateData.targetCurrency || "USD",
      color: "#606060",
      percentage:
        percentage > 1
          ? Math.round(percentage)
          : Math.round(percentage * 100) / 100,
    });
  }

  return categorySpending
    .sort((left, right) => right.amount - left.amount)
    .map((item) => ({
      ...item,
      amount: Number.parseFloat(Number(item.amount).toFixed(2)),
      percentage: Number.parseFloat(Number(item.percentage).toFixed(2)),
    }));
}

export const getSpending = reuseQueryResult({
  keyPrefix: "spending",
  keyFn: serializeMetricRangeParams,
  load: getSpendingImpl,
});
