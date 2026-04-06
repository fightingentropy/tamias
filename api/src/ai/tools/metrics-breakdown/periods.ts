import {
  eachMonthOfInterval,
  endOfMonth,
  format,
  formatISO,
  isSameMonth,
  parseISO,
  startOfMonth,
} from "date-fns";
import type { MonthlyPeriod } from "./types";

export function splitDateRangeByMonth(from: string, to: string): MonthlyPeriod[] {
  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  const months = eachMonthOfInterval({ start: fromDate, end: toDate });

  return months.map((month) => ({
    from: formatISO(startOfMonth(month), { representation: "date" }),
    to: formatISO(endOfMonth(month), { representation: "date" }),
    monthKey: format(month, "yyyy-MM"),
  }));
}

export function spansMultipleMonths(from: string, to: string): boolean {
  return !isSameMonth(parseISO(from), parseISO(to));
}
