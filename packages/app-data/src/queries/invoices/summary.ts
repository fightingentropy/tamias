import { getInvoiceAggregateRowsFromConvex } from "@tamias/app-data-convex";
import type { Database } from "../../client";
import { reuseQueryResult } from "../../utils/request-cache";
import { getExchangeRatesBatch } from "../exhange-rates";
import { getTeamById } from "../teams";
import { getValidInvoiceStatuses } from "./reads-shared";
import type { GetInvoiceSummaryParams } from "./types";

async function getInvoiceSummaryImpl(
  db: Database,
  params: GetInvoiceSummaryParams,
) {
  const { teamId, statuses } = params;

  const team = await getTeamById(db, teamId);
  const baseCurrency = team?.baseCurrency || "USD";
  const validStatuses = getValidInvoiceStatuses(statuses);
  const currencyTotals = (
    await getInvoiceAggregateRowsFromConvex({
      teamId,
      statuses: validStatuses.length > 0 ? validStatuses : undefined,
    })
  ).map((row) => ({
    currency: row.currency || baseCurrency,
    totalAmount: Number(row.totalAmount) || 0,
    invoiceCount: Number(row.invoiceCount) || 0,
  }));

  if (currencyTotals.length === 0) {
    return {
      totalAmount: 0,
      invoiceCount: 0,
      currency: baseCurrency,
    };
  }

  const foreignCurrencies = currencyTotals
    .map((row) => row.currency || baseCurrency)
    .filter((currency) => currency !== baseCurrency);

  const rateMap = new Map<string, number>();
  if (foreignCurrencies.length > 0) {
    const pairs = foreignCurrencies.map((currency) => ({
      base: currency,
      target: baseCurrency,
    }));
    const batchRates = await getExchangeRatesBatch(db, { pairs });
    for (const [key, rate] of batchRates) {
      const base = key.split(":")[0];
      if (base) rateMap.set(base, rate);
    }
  }

  let totalAmount = 0;
  let invoiceCount = 0;
  const breakdown: Array<{
    currency: string;
    originalAmount: number;
    convertedAmount: number;
    count: number;
  }> = [];

  for (const row of currencyTotals) {
    const currency = row.currency || baseCurrency;
    const amount = Number(row.totalAmount) || 0;
    const rowCount = Number(row.invoiceCount) || 0;

    if (currency === baseCurrency) {
      totalAmount += amount;
      breakdown.push({
        currency,
        originalAmount: Math.round(amount * 100) / 100,
        convertedAmount: Math.round(amount * 100) / 100,
        count: rowCount,
      });
      invoiceCount += rowCount;
    } else {
      const rate = rateMap.get(currency);
      if (rate) {
        const convertedAmount = amount * rate;
        totalAmount += convertedAmount;
        breakdown.push({
          currency,
          originalAmount: Math.round(amount * 100) / 100,
          convertedAmount: Math.round(convertedAmount * 100) / 100,
          count: rowCount,
        });
        invoiceCount += rowCount;
      }
    }
  }

  breakdown.sort((left, right) => right.originalAmount - left.originalAmount);

  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    invoiceCount,
    currency: baseCurrency,
    breakdown: breakdown.length > 1 ? breakdown : undefined,
  };
}

export async function getInvoiceSummary(
  db: Database,
  params: GetInvoiceSummaryParams,
) {
  return getInvoiceSummaryImpl(db, params);
}
