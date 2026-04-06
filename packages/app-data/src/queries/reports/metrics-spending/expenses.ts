import { eachMonthOfInterval, format } from "date-fns";
import type { Database } from "../../../client";
import { reuseQueryResult } from "../../../utils/request-cache";
import { serializeMetricRangeParams } from "../metrics-common";
import { getMonthBucket, roundMoney } from "../shared";
import { getMetricAggregateData } from "./common";

export type GetExpensesParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
  exactDates?: boolean;
};

interface ExpensesResultItem {
  value: string;
  date: string;
  currency: string;
  recurring_value?: number;
}

async function getExpensesImpl(db: Database, params: GetExpensesParams) {
  const aggregateData = await getMetricAggregateData(db, params);
  const monthSeries = eachMonthOfInterval({
    start: aggregateData.fromDate,
    end: aggregateData.toDate,
  });
  const dataMap = new Map<string, { value: number; recurringValue: number }>();

  for (const row of aggregateData.rows.filter((aggregateRow) => {
    const slug = aggregateRow.categorySlug;

    return (
      aggregateRow.direction === "expense" &&
      (slug === null || !aggregateData.excludedCategorySlugs.includes(slug))
    );
  })) {
    const month = getMonthBucket(row.date);
    const current = dataMap.get(month) ?? { value: 0, recurringValue: 0 };
    const value = Math.abs(row.totalAmount);

    if (row.recurring) {
      current.recurringValue = roundMoney(current.recurringValue + value);
    } else {
      current.value = roundMoney(current.value + value);
    }

    dataMap.set(month, current);
  }

  const rawData: ExpensesResultItem[] = monthSeries.map((monthStart) => {
    const monthKey = format(monthStart, "yyyy-MM-dd");
    const monthData = dataMap.get(monthKey) || {
      value: 0,
      recurringValue: 0,
    };

    return {
      date: monthKey,
      value: monthData.value.toString(),
      currency: aggregateData.targetCurrency || "USD",
      recurring_value: monthData.recurringValue,
    };
  });

  const averageExpense =
    rawData.length > 0
      ? Number(
          (
            rawData.reduce((sum, item) => sum + Number.parseFloat(item.value || "0"), 0) /
            rawData.length
          ).toFixed(2),
        )
      : 0;

  return {
    summary: {
      averageExpense,
      currency: rawData.at(0)?.currency ?? params.currency,
    },
    meta: {
      type: "expense",
      currency: rawData.at(0)?.currency ?? params.currency,
    },
    result: rawData.map((item) => {
      const value = Number.parseFloat(Number.parseFloat(item.value || "0").toFixed(2));
      const recurring = Number.parseFloat(
        Number.parseFloat(
          item.recurring_value !== undefined ? String(item.recurring_value) : "0",
        ).toFixed(2),
      );

      return {
        date: item.date,
        value,
        currency: item.currency,
        recurring,
        total: Number((value + recurring).toFixed(2)),
      };
    }),
  };
}

export const getExpenses = reuseQueryResult({
  keyPrefix: "expenses",
  keyFn: serializeMetricRangeParams,
  load: getExpensesImpl,
});
