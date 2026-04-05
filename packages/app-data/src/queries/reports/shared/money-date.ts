import { UTCDate } from "@date-fns/utc";
import { format, parseISO, startOfMonth } from "date-fns";
import type { ReportTransactionAggregateRow } from "./types";

export function getPercentageIncrease(a: number, b: number) {
  return a > 0 && b > 0 ? Math.abs(((a - b) / b) * 100).toFixed() : 0;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function getMonthBucket(date: string) {
  return format(startOfMonth(new UTCDate(parseISO(date))), "yyyy-MM-dd");
}

export function buildMonthlyAggregateSeriesMap(
  rows: ReportTransactionAggregateRow[],
  getValue: (row: ReportTransactionAggregateRow) => number,
) {
  const monthlyValues = new Map<string, number>();

  for (const row of rows) {
    const month = getMonthBucket(row.date);
    monthlyValues.set(
      month,
      roundMoney((monthlyValues.get(month) ?? 0) + getValue(row)),
    );
  }

  return monthlyValues;
}
