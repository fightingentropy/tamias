import { tz } from "@date-fns/tz";
import { addDays, addMonths, getDay, lastDayOfMonth, setDate, setDay } from "date-fns";
import {
  type InvoiceRecurringEndType,
  type InvoiceRecurringFrequency,
  isDateInFutureUTC,
  RECURRING_END_TYPES,
  RECURRING_FREQUENCIES,
  RECURRING_STATUSES,
} from "./recurring";

export type {
  InvoiceRecurringEndType,
  InvoiceRecurringFrequency,
  InvoiceRecurringStatus,
} from "./recurring";

export {
  isDateInFutureUTC,
  RECURRING_END_TYPES,
  RECURRING_FREQUENCIES,
  RECURRING_STATUSES,
} from "./recurring";

export interface RecurringInvoiceParams {
  frequency: InvoiceRecurringFrequency;
  frequencyDay: number | null;
  frequencyWeek: number | null;
  frequencyInterval: number | null;
  timezone: string;
}

export interface UpcomingInvoice {
  date: string;
  amount: number;
}

export interface UpcomingSummary {
  hasEndDate: boolean;
  totalCount: number | null;
  totalAmount: number | null;
  currency: string;
}

function getNthWeekdayOfMonth(
  year: number,
  month: number,
  dayOfWeek: number,
  week: number,
  timezone: string,
): Date {
  const createTZDate = tz(timezone);
  let date = createTZDate(new Date(year, month, 1));

  const currentDayOfWeek = getDay(date);
  const daysUntilTarget =
    dayOfWeek >= currentDayOfWeek
      ? dayOfWeek - currentDayOfWeek
      : 7 - (currentDayOfWeek - dayOfWeek);

  date = addDays(date, daysUntilTarget);
  date = addDays(date, (week - 1) * 7);

  return date;
}

export function calculateNextScheduledDate(
  params: RecurringInvoiceParams,
  currentDate: Date,
): Date {
  const { frequency, frequencyDay, frequencyWeek, frequencyInterval, timezone } = params;

  const createTZDate = tz(timezone);
  const tzCurrentDate = createTZDate(currentDate);

  let nextDate: Date;

  switch (frequency) {
    case "weekly": {
      const targetDay = Math.min(Math.max(frequencyDay ?? 0, 0), 6);
      nextDate = setDay(addDays(tzCurrentDate, 1), targetDay, {
        weekStartsOn: 0,
      });
      if (nextDate <= tzCurrentDate) {
        nextDate = addDays(nextDate, 7);
      }
      break;
    }

    case "biweekly":
      nextDate = addDays(tzCurrentDate, 14);
      break;

    case "monthly_date": {
      const targetDayOfMonth = frequencyDay ?? 1;
      const nextMonth = addMonths(tzCurrentDate, 1);
      const lastDay = lastDayOfMonth(nextMonth).getDate();
      const actualDay = Math.min(targetDayOfMonth, lastDay);
      nextDate = setDate(nextMonth, actualDay);
      break;
    }

    case "monthly_weekday": {
      const targetDayOfWeek = Math.min(Math.max(frequencyDay ?? 0, 0), 6);
      const targetWeek = Math.min(Math.max(frequencyWeek ?? 1, 1), 5);
      const nextMonth = addMonths(tzCurrentDate, 1);
      nextDate = getNthWeekdayOfMonth(
        nextMonth.getFullYear(),
        nextMonth.getMonth(),
        targetDayOfWeek,
        targetWeek,
        timezone,
      );
      break;
    }

    case "monthly_last_day": {
      const nextMonthForLastDay = addMonths(tzCurrentDate, 1);
      nextDate = lastDayOfMonth(nextMonthForLastDay);
      break;
    }

    case "quarterly": {
      const targetDayOfMonth = frequencyDay ?? tzCurrentDate.getDate();
      const nextQuarter = addMonths(tzCurrentDate, 3);
      const lastDay = lastDayOfMonth(nextQuarter).getDate();
      nextDate = setDate(nextQuarter, Math.min(targetDayOfMonth, lastDay));
      break;
    }

    case "semi_annual": {
      const targetDayOfMonth = frequencyDay ?? tzCurrentDate.getDate();
      const nextSemiAnnual = addMonths(tzCurrentDate, 6);
      const lastDay = lastDayOfMonth(nextSemiAnnual).getDate();
      nextDate = setDate(nextSemiAnnual, Math.min(targetDayOfMonth, lastDay));
      break;
    }

    case "annual": {
      const targetDayOfMonth = frequencyDay ?? tzCurrentDate.getDate();
      const nextAnnual = addMonths(tzCurrentDate, 12);
      const lastDay = lastDayOfMonth(nextAnnual).getDate();
      nextDate = setDate(nextAnnual, Math.min(targetDayOfMonth, lastDay));
      break;
    }

    case "custom":
      nextDate = addDays(tzCurrentDate, frequencyInterval ?? 1);
      break;

    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }

  return new Date(nextDate.getTime());
}

export function calculateFirstScheduledDate(
  _params: RecurringInvoiceParams,
  issueDate: Date,
  now: Date = new Date(),
): Date {
  if (isDateInFutureUTC(issueDate, now)) {
    return issueDate;
  }

  return now;
}

export function calculateUpcomingDates(
  params: RecurringInvoiceParams,
  startDate: Date,
  amount: number,
  currency: string,
  endType: InvoiceRecurringEndType,
  endDate: Date | null,
  endCount: number | null,
  alreadyGenerated = 0,
  limit = 10,
): { invoices: UpcomingInvoice[]; summary: UpcomingSummary } {
  const invoices: UpcomingInvoice[] = [];
  let currentDate = startDate;
  let count = 0;
  const maxIterations = endType === "never" ? limit : Math.min(limit, 100);
  const remaining =
    endType === "after_count" && endCount !== null ? endCount - alreadyGenerated : null;

  while (count < maxIterations) {
    if (endType === "on_date" && endDate && currentDate > endDate) {
      break;
    }
    if (remaining !== null && count >= remaining) {
      break;
    }

    invoices.push({
      date: currentDate.toISOString(),
      amount,
    });

    count++;
    currentDate = calculateNextScheduledDate(params, currentDate);
  }

  let totalCount: number | null = null;
  let totalAmount: number | null = null;

  if (endType === "after_count" && endCount !== null) {
    totalCount = endCount;
    totalAmount = endCount * amount;
  } else if (endType === "on_date" && endDate) {
    let tempDate = startDate;
    let tempCount = 0;
    while (tempDate <= endDate && tempCount < 1000) {
      tempCount++;
      tempDate = calculateNextScheduledDate(params, tempDate);
    }
    totalCount = tempCount;
    totalAmount = tempCount * amount;
  }

  return {
    invoices,
    summary: {
      hasEndDate: endType !== "never",
      totalCount,
      totalAmount,
      currency,
    },
  };
}

export function shouldMarkCompleted(
  endType: InvoiceRecurringEndType,
  endDate: Date | null,
  endCount: number | null,
  invoicesGenerated: number,
  nextScheduledAt: Date | null,
): boolean {
  switch (endType) {
    case "never":
      return false;
    case "on_date":
      return endDate !== null && nextScheduledAt !== null && nextScheduledAt > endDate;
    case "after_count":
      return endCount !== null && invoicesGenerated >= endCount;
    default:
      return false;
  }
}

export function advanceToFutureDate(
  params: RecurringInvoiceParams,
  scheduledDate: Date,
  now: Date,
  maxIterations = 1000,
): { date: Date; intervalsSkipped: number; hitSafetyLimit: boolean } {
  let nextDate = scheduledDate;
  let intervalsSkipped = 0;

  while (nextDate <= now && intervalsSkipped < maxIterations) {
    nextDate = calculateNextScheduledDate(params, nextDate);
    intervalsSkipped++;
  }

  const hitSafetyLimit = intervalsSkipped >= maxIterations;
  if (hitSafetyLimit) {
    nextDate = calculateNextScheduledDate(params, now);
  }

  return {
    date: nextDate,
    intervalsSkipped: hitSafetyLimit ? 0 : intervalsSkipped,
    hitSafetyLimit,
  };
}
