import { getInvoiceAggregateRowsFromConvex } from "../../convex";
import { parseISO } from "date-fns";
import type { Database } from "../../client";
import { getTargetCurrency, roundMoney } from "./shared";

export type GetOutstandingInvoicesParams = {
  teamId: string;
  currency?: string;
  status?: ("unpaid" | "overdue")[];
};

export type GetOverdueInvoicesAlertParams = {
  teamId: string;
  currency?: string;
};

async function getOverdueInvoicesAlertImpl(
  db: Database,
  params: GetOverdueInvoicesAlertParams,
) {
  const { teamId, currency: inputCurrency } = params;

  const targetCurrency = await getTargetCurrency(db, teamId, inputCurrency);
  const grouped = new Map<
    string,
    { count: number; totalAmount: number; oldestDueDate: string | null }
  >();

  for (const row of await getInvoiceAggregateRowsFromConvex({
    teamId,
    statuses: ["overdue"],
  })) {
    const currency = row.currency ?? targetCurrency ?? "USD";

    if (inputCurrency && currency !== inputCurrency) {
      continue;
    }

    const current = grouped.get(currency) ?? {
      count: 0,
      totalAmount: 0,
      oldestDueDate: null,
    };

    current.count += Number(row.invoiceCount || 0);
    current.totalAmount = roundMoney(
      current.totalAmount + Number(row.totalAmount ?? 0),
    );

    if (
      row.oldestDueDate &&
      (!current.oldestDueDate || row.oldestDueDate < current.oldestDueDate)
    ) {
      current.oldestDueDate = row.oldestDueDate;
    }

    grouped.set(currency, current);
  }

  const result = [...grouped.entries()].map(([currency, value]) => ({
    currency,
    ...value,
  }));

  let totalCount = 0;
  let totalAmount = 0;
  let oldestDueDate: string | null = null;
  let mainCurrency = targetCurrency || "USD";

  if (result.length > 0) {
    if (inputCurrency && targetCurrency) {
      const singleResult = result[0];
      totalCount = Number(singleResult?.count || 0);
      totalAmount = Number(singleResult?.totalAmount || 0);
      oldestDueDate = singleResult?.oldestDueDate || null;
      mainCurrency = singleResult?.currency || targetCurrency;
    } else {
      totalCount = result.reduce(
        (sum, item) => sum + Number(item.count || 0),
        0,
      );

      const primaryResult =
        result.find((item) => item.currency === targetCurrency) || result[0];
      totalAmount = Number(primaryResult?.totalAmount || 0);
      oldestDueDate = primaryResult?.oldestDueDate || null;
      mainCurrency = primaryResult?.currency || targetCurrency || "USD";
    }
  }

  let daysOverdue = 0;

  if (oldestDueDate) {
    const now = new Date();
    const dueDate = parseISO(oldestDueDate);
    daysOverdue = Math.floor(
      (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  return {
    summary: {
      count: totalCount,
      totalAmount: Number(totalAmount.toFixed(2)),
      currency: mainCurrency,
      oldestDueDate,
      daysOverdue,
    },
    meta: {
      type: "overdue_invoices_alert",
      currency: mainCurrency,
    },
  };
}

export async function getOverdueInvoicesAlert(
  db: Database,
  params: GetOverdueInvoicesAlertParams,
) {
  return getOverdueInvoicesAlertImpl(db, params);
}

async function getOutstandingInvoicesImpl(
  db: Database,
  params: GetOutstandingInvoicesParams,
) {
  const {
    teamId,
    currency: inputCurrency,
    status = ["unpaid", "overdue", "draft", "scheduled"],
  } = params;

  const targetCurrency = await getTargetCurrency(db, teamId, inputCurrency);
  const statuses = new Set(status);
  const grouped = new Map<string, { count: number; totalAmount: number }>();

  for (const row of await getInvoiceAggregateRowsFromConvex({
    teamId,
    statuses: status,
  })) {
    if (!statuses.has(row.status as (typeof status)[number])) {
      continue;
    }

    const currency = row.currency ?? targetCurrency ?? "USD";

    if (inputCurrency && currency !== inputCurrency) {
      continue;
    }

    const current = grouped.get(currency) ?? { count: 0, totalAmount: 0 };

    current.count += Number(row.invoiceCount || 0);
    current.totalAmount = roundMoney(
      current.totalAmount + Number(row.totalAmount ?? 0),
    );
    grouped.set(currency, current);
  }

  const result = [...grouped.entries()].map(([currency, value]) => ({
    currency,
    ...value,
  }));

  let totalCount = 0;
  let totalAmount = 0;
  let mainCurrency = targetCurrency || "USD";

  if (result.length > 0) {
    if (inputCurrency && targetCurrency) {
      const singleResult = result[0];
      totalCount = Number(singleResult?.count || 0);
      totalAmount = Number(singleResult?.totalAmount || 0);
      mainCurrency = singleResult?.currency || targetCurrency;
    } else {
      totalCount = result.reduce(
        (sum, item) => sum + Number(item.count || 0),
        0,
      );

      const primaryResult =
        result.find((item) => item.currency === targetCurrency) || result[0];
      totalAmount = Number(primaryResult?.totalAmount || 0);
      mainCurrency = primaryResult?.currency || targetCurrency || "USD";
    }
  }

  return {
    summary: {
      count: totalCount,
      totalAmount: Number(totalAmount.toFixed(2)),
      currency: mainCurrency,
      status,
    },
    meta: {
      type: "outstanding_invoices",
      currency: mainCurrency,
      status,
    },
  };
}

export async function getOutstandingInvoices(
  db: Database,
  params: GetOutstandingInvoicesParams,
) {
  return getOutstandingInvoicesImpl(db, params);
}
