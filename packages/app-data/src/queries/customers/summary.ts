import { getInvoiceAggregateRowsFromConvex } from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { getExchangeRatesBatch, getTeamById } from "../index";
import type { GetCustomerInvoiceSummaryParams } from "./types";

export async function getCustomerInvoiceSummary(
  db: Database,
  params: GetCustomerInvoiceSummaryParams,
) {
  const { customerId, teamId } = params;
  const team = await getTeamById(db, teamId);
  const baseCurrency = team?.baseCurrency || "USD";
  const summaryRows = await getInvoiceAggregateRowsFromConvex({
    teamId,
    customerId,
  });

  if (summaryRows.length === 0) {
    return {
      totalAmount: 0,
      paidAmount: 0,
      outstandingAmount: 0,
      invoiceCount: 0,
      currency: baseCurrency,
    };
  }

  const currenciesToConvert = [
    ...new Set(
      summaryRows
        .map((row) => row.currency || baseCurrency)
        .filter((currency) => currency !== baseCurrency),
    ),
  ];

  const exchangeRateMap = new Map<string, number>();

  if (currenciesToConvert.length > 0) {
    const pairs = currenciesToConvert.map((currency) => ({
      base: currency,
      target: baseCurrency,
    }));
    const batchRates = await getExchangeRatesBatch(db, { pairs });

    for (const [key, rate] of batchRates) {
      const base = key.split(":")[0];

      if (base) {
        exchangeRateMap.set(base, rate);
      }
    }
  }

  let totalAmount = 0;
  let paidAmount = 0;
  let outstandingAmount = 0;
  let invoiceCount = 0;

  for (const row of summaryRows) {
    const amount = Number(row.totalAmount) || 0;
    const rowCount = Number(row.invoiceCount) || 0;
    const currency = row.currency || baseCurrency;
    let convertedAmount = amount;
    let canConvert = true;

    if (currency !== baseCurrency) {
      const exchangeRate = exchangeRateMap.get(currency);

      if (exchangeRate) {
        convertedAmount = amount * exchangeRate;
      } else {
        canConvert = false;
      }
    }

    if (!canConvert) {
      continue;
    }

    if (row.status === "paid") {
      paidAmount += convertedAmount;
      totalAmount += convertedAmount;
      invoiceCount += rowCount;
    } else if (row.status === "unpaid" || row.status === "overdue") {
      outstandingAmount += convertedAmount;
      totalAmount += convertedAmount;
      invoiceCount += rowCount;
    }
  }

  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    paidAmount: Math.round(paidAmount * 100) / 100,
    outstandingAmount: Math.round(outstandingAmount * 100) / 100,
    invoiceCount,
    currency: baseCurrency,
  };
}
