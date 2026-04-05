import { roundCurrency } from "@tamias/compliance";
import { differenceInCalendarDays } from "date-fns";

export function inclusiveDayCount(start: Date, end: Date) {
  return differenceInCalendarDays(end, start) + 1;
}

export function formatMoney(value: number) {
  return roundCurrency(value).toFixed(2);
}
