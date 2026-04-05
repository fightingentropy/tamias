import {
  getInvoiceAnalyticsAggregateRowsFromConvex,
} from "../../convex";
import type { Database } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";

type PaymentStatusResult = {
  score: number;
  paymentStatus: string;
};

type PaymentStatusSample = {
  dueDate: string;
  paidAt: string | null;
  status: "paid" | "unpaid" | "overdue";
  count: number;
};

function getMostRecentPaymentStatusSamples(
  rows: Array<{
    dueDate: string | null;
    date: string;
    status: string;
    invoiceCount: number;
  }>,
  currentDate: Date,
  limit: number,
): PaymentStatusSample[] {
  const candidates = rows
    .filter((row) => {
      if (!row.dueDate || row.invoiceCount <= 0) {
        return false;
      }

      if (row.status === "paid") {
        return true;
      }

      if (row.status === "unpaid" || row.status === "overdue") {
        return new Date(row.dueDate).getTime() < currentDate.getTime();
      }

      return false;
    })
    .sort((left, right) => {
      const dueDateDelta =
        new Date(right.dueDate!).getTime() - new Date(left.dueDate!).getTime();

      if (dueDateDelta !== 0) {
        return dueDateDelta;
      }

      return new Date(right.date).getTime() - new Date(left.date).getTime();
    });

  const samples: PaymentStatusSample[] = [];
  let remaining = limit;

  for (const row of candidates) {
    if (remaining <= 0) {
      break;
    }

    const count = Math.min(row.invoiceCount, remaining);
    remaining -= count;
    samples.push({
      dueDate: row.dueDate!,
      paidAt: row.status === "paid" ? row.date : null,
      status: row.status as PaymentStatusSample["status"],
      count,
    });
  }

  return samples;
}

async function getPaymentStatusImpl(
  _db: Database,
  teamId: string,
): Promise<PaymentStatusResult> {
  const currentDate = new Date();
  const [paidRows, openRows] = await Promise.all([
    getInvoiceAnalyticsAggregateRowsFromConvex({
      teamId,
      dateField: "paidAt",
      statuses: ["paid"],
    }),
    getInvoiceAnalyticsAggregateRowsFromConvex({
      teamId,
      dateField: "createdAt",
      statuses: ["unpaid", "overdue"],
    }),
  ]);
  const invoiceData = getMostRecentPaymentStatusSamples(
    [...paidRows, ...openRows],
    currentDate,
    50,
  );

  if (invoiceData.length === 0) {
    return {
      score: 0,
      paymentStatus: "none",
    };
  }

  let totalWeightedDays = 0;
  let totalWeight = 0;
  let onTimeCount = 0;
  let lateCount = 0;

  for (const invoice of invoiceData) {
    const dueDate = new Date(invoice.dueDate);
    let daysOverdue = 0;

    if (invoice.status === "paid" && invoice.paidAt) {
      const paidDate = new Date(invoice.paidAt);
      daysOverdue =
        (paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24);
    } else if (
      (invoice.status === "unpaid" || invoice.status === "overdue") &&
      invoice.paidAt === null
    ) {
      daysOverdue =
        (currentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24);
    }

    const daysSinceDue = Math.abs(
      (Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const weight = daysSinceDue <= 90 ? 1.5 : 1.0;

    totalWeightedDays += daysOverdue * weight * invoice.count;
    totalWeight += weight * invoice.count;

    if (daysOverdue <= 3) {
      onTimeCount += invoice.count;
    } else {
      lateCount += invoice.count;
    }
  }

  const avgDaysOverdue = totalWeightedDays / totalWeight;
  const onTimeRate = onTimeCount / (onTimeCount + lateCount);

  let baseScore: number;

  if (avgDaysOverdue <= 3) {
    baseScore = 100;
  } else if (avgDaysOverdue <= 7) {
    baseScore = Math.round(100 - ((avgDaysOverdue - 3) / 4) * 15);
  } else if (avgDaysOverdue <= 14) {
    baseScore = Math.round(85 - ((avgDaysOverdue - 7) / 7) * 20);
  } else if (avgDaysOverdue <= 30) {
    baseScore = Math.round(65 - ((avgDaysOverdue - 14) / 16) * 25);
  } else {
    baseScore = Math.round(Math.max(0, 40 - ((avgDaysOverdue - 30) / 30) * 40));
  }

  const rateBonus = Math.round((onTimeRate - 0.5) * 20);
  const score = Math.max(0, Math.min(100, baseScore + rateBonus));

  let paymentStatus: string;
  if (score >= 80) {
    paymentStatus = "good";
  } else if (score >= 60) {
    paymentStatus = "average";
  } else {
    paymentStatus = "bad";
  }

  return {
    score,
    paymentStatus,
  };
}

export const getPaymentStatus = reuseQueryResult({
  keyPrefix: "invoice-payment-status",
  keyFn: (teamId: string) => teamId,
  load: getPaymentStatusImpl,
});
