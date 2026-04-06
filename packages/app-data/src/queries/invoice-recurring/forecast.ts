import { UTCDate } from "@date-fns/utc";
import { addMonths, endOfMonth, format, parseISO } from "date-fns";
import { calculateUpcomingDates } from "@tamias/invoice/server-recurring";
import type { Database } from "../../client";
import {
  buildRecurringParams,
  getProjectedInvoiceRecurringForTeam,
  type GetRecurringInvoiceProjectionParams,
  type InvoiceRecurringByIdResult,
  type RecurringInvoiceProjectionResult,
} from "./shared";

function calculateInvoiceLimitForPeriod(
  recurring: Pick<InvoiceRecurringByIdResult, "frequency" | "frequencyInterval">,
  forecastMonths: number,
): number {
  const buffer = 2;

  switch (recurring.frequency) {
    case "weekly":
      return Math.ceil(forecastMonths * 4.33) + buffer;
    case "biweekly":
      return Math.ceil(forecastMonths * 2.17) + buffer;
    case "monthly_date":
    case "monthly_weekday":
    case "monthly_last_day":
      return forecastMonths + buffer;
    case "quarterly":
      return Math.ceil(forecastMonths / 3) + buffer;
    case "semi_annual":
      return Math.ceil(forecastMonths / 6) + buffer;
    case "annual":
      return Math.ceil(forecastMonths / 12) + buffer;
    case "custom":
      if (recurring.frequencyInterval && recurring.frequencyInterval > 0) {
        return Math.ceil(forecastMonths * (30.44 / recurring.frequencyInterval)) + buffer;
      }

      return forecastMonths + buffer;
    default:
      return forecastMonths + buffer;
  }
}

export async function getRecurringInvoiceProjection(
  _db: Database,
  params: GetRecurringInvoiceProjectionParams,
): Promise<RecurringInvoiceProjectionResult> {
  const activeRecurring = (await getProjectedInvoiceRecurringForTeam(params.teamId)).filter(
    (record) =>
      record.status === "active" && (!params.currency || record.currency === params.currency),
  );
  const projection: RecurringInvoiceProjectionResult = new Map();
  const forecastEndDate = endOfMonth(addMonths(new UTCDate(), params.forecastMonths));

  for (const recurring of activeRecurring) {
    if (!recurring.nextScheduledAt || !recurring.amount) {
      continue;
    }

    const upcoming = calculateUpcomingDates(
      buildRecurringParams(recurring),
      new Date(recurring.nextScheduledAt),
      recurring.amount,
      recurring.currency ?? "USD",
      recurring.endType,
      recurring.endDate ? new Date(recurring.endDate) : null,
      recurring.endCount,
      recurring.invoicesGenerated,
      calculateInvoiceLimitForPeriod(recurring, params.forecastMonths),
    );

    for (const invoice of upcoming.invoices) {
      const invoiceDate = parseISO(invoice.date);

      if (invoiceDate > forecastEndDate) {
        continue;
      }

      const monthKey = format(invoiceDate, "yyyy-MM");
      const existing = projection.get(monthKey) || { amount: 0, count: 0 };

      projection.set(monthKey, {
        amount: existing.amount + invoice.amount,
        count: existing.count + 1,
      });
    }
  }

  return projection;
}
