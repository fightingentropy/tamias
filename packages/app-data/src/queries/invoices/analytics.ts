import { UTCDate } from "@date-fns/utc";
import {
  eachMonthOfInterval,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import type { Database } from "../../client";
import { getProjectedInvoicesByFilters } from "../invoice-projections";
import { getCustomerPageSummary } from "../customer-summary";
import { getTeamById } from "../teams";

export type GetMostActiveClientParams = {
  teamId: string;
};

export async function getMostActiveClient(
  db: Database,
  params: GetMostActiveClientParams,
) {
  return (await getCustomerPageSummary(db, params)).mostActiveClient;
}

export type GetInactiveClientsCountParams = {
  teamId: string;
};

export async function getInactiveClientsCount(
  db: Database,
  params: GetInactiveClientsCountParams,
) {
  return (await getCustomerPageSummary(db, params)).inactiveClientsCount;
}

export type GetAverageDaysToPaymentParams = {
  teamId: string;
};

export async function getAverageDaysToPayment(
  _db: Database,
  params: GetAverageDaysToPaymentParams,
) {
  const { teamId } = params;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const paidInvoices = (await getProjectedInvoicesByFilters({
    teamId,
    statuses: ["paid"],
    dateField: "paidAt",
    from: thirtyDaysAgo.toISOString(),
  })).filter((invoice) => !!invoice.paidAt && !!invoice.sentAt);

  if (paidInvoices.length === 0) {
    return 0;
  }

  const totalDays = paidInvoices.reduce((sum, invoice) => {
    const paidAt = invoice.paidAt ? new Date(invoice.paidAt).getTime() : 0;
    const sentAt = invoice.sentAt ? new Date(invoice.sentAt).getTime() : 0;

    return sum + (paidAt - sentAt) / (1000 * 60 * 60 * 24);
  }, 0);

  return Math.round(totalDays / paidInvoices.length);
}

export type GetAverageInvoiceSizeParams = {
  teamId: string;
};

export async function getAverageInvoiceSize(
  _db: Database,
  params: GetAverageInvoiceSizeParams,
) {
  const { teamId } = params;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const grouped = new Map<
    string,
    {
      currency: string | null;
      totalAmount: number;
      invoiceCount: number;
    }
  >();

  for (const invoice of await getProjectedInvoicesByFilters({
    teamId,
    dateField: "sentAt",
    from: thirtyDaysAgo.toISOString(),
  })) {
    const currency = invoice.currency ?? null;
    const key = currency ?? "__null__";
    const current = grouped.get(key) ?? {
      currency,
      totalAmount: 0,
      invoiceCount: 0,
    };

    current.totalAmount += Number(invoice.amount) || 0;
    current.invoiceCount += 1;
    grouped.set(key, current);
  }

  return [...grouped.values()].map((entry) => ({
    currency: entry.currency,
    averageAmount:
      entry.invoiceCount > 0
        ? Math.round((entry.totalAmount / entry.invoiceCount) * 100) / 100
        : 0,
    invoiceCount: entry.invoiceCount,
  }));
}

export type GetInvoicePaymentAnalysisParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
};

export type InvoicePaymentAnalysisResult = {
  metrics: {
    averageDaysToPay: number;
    paymentRate: number;
    overdueRate: number;
    paymentScore: number;
    totalInvoices: number;
    paidInvoices: number;
    unpaidInvoices: number;
    overdueInvoices: number;
    overdueAmount: number;
  };
  paymentTrends: Array<{
    month: string;
    averageDaysToPay: number;
    paymentRate: number;
    invoiceCount: number;
  }>;
  overdueSummary: {
    count: number;
    totalAmount: number;
    oldestDays: number;
  };
};

export async function getInvoicePaymentAnalysis(
  db: Database,
  params: GetInvoicePaymentAnalysisParams,
): Promise<InvoicePaymentAnalysisResult> {
  const { teamId, from, to, currency: inputCurrency } = params;

  const fromDate = startOfMonth(new UTCDate(parseISO(from)));
  const toDate = endOfMonth(new UTCDate(parseISO(to)));

  const team = await getTeamById(db, teamId);
  const targetCurrency = inputCurrency || team?.baseCurrency || "USD";
  const allInvoices = (await getProjectedInvoicesByFilters({
    teamId,
    currency: inputCurrency,
    dateField: "createdAt",
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
  }))
    .map((invoice) => ({
      id: invoice.id,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      createdAt: invoice.createdAt,
      issueDate: invoice.issueDate,
    }));

  if (allInvoices.length === 0) {
    return {
      metrics: {
        averageDaysToPay: 0,
        paymentRate: 0,
        overdueRate: 0,
        paymentScore: 0,
        totalInvoices: 0,
        paidInvoices: 0,
        unpaidInvoices: 0,
        overdueInvoices: 0,
        overdueAmount: 0,
      },
      paymentTrends: [],
      overdueSummary: {
        count: 0,
        totalAmount: 0,
        oldestDays: 0,
      },
    };
  }

  const paidInvoices = allInvoices.filter(
    (invoice) => invoice.status === "paid",
  );
  const unpaidInvoices = allInvoices.filter(
    (invoice) => invoice.status === "unpaid" || invoice.status === "overdue",
  );
  const overdueInvoices = allInvoices.filter(
    (invoice) =>
      (invoice.status === "overdue" ||
        (invoice.status === "unpaid" &&
          invoice.dueDate &&
          parseISO(invoice.dueDate) < new Date())) &&
      !invoice.paidAt,
  );

  let totalDaysToPay = 0;
  let paidCount = 0;

  for (const invoice of paidInvoices) {
    if (invoice.paidAt) {
      const issueDate =
        invoice.issueDate || invoice.createdAt || invoice.dueDate;
      if (issueDate) {
        const daysToPay =
          (new Date(invoice.paidAt).getTime() - parseISO(issueDate).getTime()) /
          (1000 * 60 * 60 * 24);
        if (daysToPay >= 0) {
          totalDaysToPay += daysToPay;
          paidCount++;
        }
      }
    }
  }

  const averageDaysToPay =
    paidCount > 0 ? Math.round(totalDaysToPay / paidCount) : 0;
  const paymentRate =
    allInvoices.length > 0
      ? Math.round((paidInvoices.length / allInvoices.length) * 100)
      : 0;
  const overdueRate =
    allInvoices.length > 0
      ? Math.round((overdueInvoices.length / allInvoices.length) * 100)
      : 0;

  let overdueAmount = 0;
  for (const invoice of overdueInvoices) {
    const amount = Number(invoice.amount) || 0;
    if (invoice.currency === targetCurrency) {
      overdueAmount += amount;
    } else {
      overdueAmount += amount;
    }
  }

  let paymentScore = 100;
  if (averageDaysToPay > 30) {
    paymentScore = Math.max(0, 100 - (averageDaysToPay - 30) * 2);
  } else if (averageDaysToPay > 14) {
    paymentScore = 85 - ((averageDaysToPay - 14) / 16) * 25;
  } else if (averageDaysToPay > 7) {
    paymentScore = 100 - ((averageDaysToPay - 7) / 7) * 15;
  }

  paymentScore = Math.max(0, Math.min(100, paymentScore - overdueRate * 0.5));

  const monthSeries = eachMonthOfInterval({ start: fromDate, end: toDate });
  const paymentTrends = monthSeries.map((monthStart) => {
    const monthEnd = endOfMonth(monthStart);
    const monthStr = format(monthStart, "yyyy-MM");

    const monthInvoices = allInvoices.filter((invoice) => {
      const invoiceDate = invoice.createdAt || invoice.issueDate;
      if (!invoiceDate) return false;
      const invoiceDateObj = parseISO(invoiceDate);
      return invoiceDateObj >= monthStart && invoiceDateObj <= monthEnd;
    });

    const monthPaid = monthInvoices.filter(
      (invoice) => invoice.status === "paid",
    );
    let monthTotalDays = 0;
    let monthPaidCount = 0;

    for (const invoice of monthPaid) {
      if (invoice.paidAt) {
        const issueDate =
          invoice.issueDate || invoice.createdAt || invoice.dueDate;
        if (issueDate) {
          const daysToPay =
            (new Date(invoice.paidAt).getTime() -
              parseISO(issueDate).getTime()) /
            (1000 * 60 * 60 * 24);
          if (daysToPay >= 0) {
            monthTotalDays += daysToPay;
            monthPaidCount++;
          }
        }
      }
    }

    const monthAvgDays =
      monthPaidCount > 0 ? Math.round(monthTotalDays / monthPaidCount) : 0;
    const monthPaymentRate =
      monthInvoices.length > 0
        ? Math.round((monthPaid.length / monthInvoices.length) * 100)
        : 0;

    return {
      month: monthStr,
      averageDaysToPay: monthAvgDays,
      paymentRate: monthPaymentRate,
      invoiceCount: monthInvoices.length,
    };
  });

  let oldestDays = 0;
  const now = new Date();
  for (const invoice of overdueInvoices) {
    if (invoice.dueDate) {
      const daysOverdue =
        (now.getTime() - parseISO(invoice.dueDate).getTime()) /
        (1000 * 60 * 60 * 24);
      oldestDays = Math.max(oldestDays, Math.round(daysOverdue));
    }
  }

  return {
    metrics: {
      averageDaysToPay,
      paymentRate,
      overdueRate,
      paymentScore: Math.round(paymentScore),
      totalInvoices: allInvoices.length,
      paidInvoices: paidInvoices.length,
      unpaidInvoices: unpaidInvoices.length,
      overdueInvoices: overdueInvoices.length,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
    },
    paymentTrends,
    overdueSummary: {
      count: overdueInvoices.length,
      totalAmount: Math.round(overdueAmount * 100) / 100,
      oldestDays,
    },
  };
}
