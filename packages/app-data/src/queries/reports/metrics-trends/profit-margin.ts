import type { Database } from "../../../client";
import { reuseQueryResult } from "../../../utils/request-cache";
import { getProfit, getRevenue } from "../core";
import { getTargetCurrency } from "../shared";

export type GetProfitMarginParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
  revenueType?: "gross" | "net";
};

async function getProfitMarginImpl(db: Database, params: GetProfitMarginParams) {
  const { teamId, from, to, currency: inputCurrency, revenueType = "net" } = params;

  const targetCurrency = await getTargetCurrency(db, teamId, inputCurrency);
  const [revenueData, profitData] = await Promise.all([
    getRevenue(db, {
      teamId,
      from,
      to,
      currency: inputCurrency,
      revenueType: "net",
    }),
    getProfit(db, {
      teamId,
      from,
      to,
      currency: inputCurrency,
      revenueType,
    }),
  ]);

  const totalRevenue = revenueData.reduce((sum, item) => sum + Number.parseFloat(item.value), 0);
  const totalProfit = profitData.reduce((sum, item) => sum + Number.parseFloat(item.value), 0);

  let profitMargin = 0;

  if (totalRevenue > 0) {
    profitMargin = (totalProfit / totalRevenue) * 100;
  }

  const monthlyMargins = revenueData.map((revenueItem, index) => {
    const profitItem = profitData[index];
    const monthRevenue = Number.parseFloat(revenueItem.value);
    const monthProfit = profitItem ? Number.parseFloat(profitItem.value) : 0;

    let monthMargin = 0;

    if (monthRevenue > 0) {
      monthMargin = (monthProfit / monthRevenue) * 100;
    }

    return {
      date: revenueItem.date,
      revenue: monthRevenue,
      profit: monthProfit,
      margin: Number(monthMargin.toFixed(2)),
      currency: revenueItem.currency,
    };
  });

  const avgMargin =
    monthlyMargins.length > 0
      ? monthlyMargins.reduce((sum, item) => sum + item.margin, 0) / monthlyMargins.length
      : 0;

  let trend: "positive" | "negative" | "neutral" = "neutral";

  if (monthlyMargins.length >= 2) {
    const firstMonth = monthlyMargins[0];
    const lastMonth = monthlyMargins[monthlyMargins.length - 1];

    if (firstMonth && lastMonth) {
      const firstMargin = firstMonth.margin;
      const lastMargin = lastMonth.margin;
      trend =
        lastMargin > firstMargin ? "positive" : lastMargin < firstMargin ? "negative" : "neutral";
    }
  }

  return {
    summary: {
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(2)),
      profitMargin: Number(profitMargin.toFixed(2)),
      averageMargin: Number(avgMargin.toFixed(2)),
      currency: targetCurrency || "USD",
      revenueType,
      trend,
      monthCount: monthlyMargins.length,
    },
    meta: {
      type: "profit_margin",
      currency: targetCurrency || "USD",
      revenueType,
      period: {
        from,
        to,
      },
    },
    result: monthlyMargins,
  };
}

export const getProfitMargin = reuseQueryResult({
  keyPrefix: "profit-margin",
  keyFn: (params: GetProfitMarginParams) =>
    [
      params.teamId,
      params.from,
      params.to,
      params.currency ?? "",
      params.revenueType ?? "net",
    ].join(":"),
  load: getProfitMarginImpl,
});
