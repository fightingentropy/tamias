import type { Database } from "../../../client";
import { getExchangeRatesBatch } from "../../exhange-rates";
import { reuseQueryResult } from "../../../utils/request-cache";
import { buildBalanceSheetAssets, getAssetCurrencyPairs } from "./assets";
import { loadBalanceSheetContext } from "./context";
import { buildBalanceSheetEquity } from "./equity";
import { buildBalanceSheetLiabilities, getLiabilityCurrencyPairs } from "./liabilities";
import type { BalanceSheetResult, GetBalanceSheetParams } from "./types";
import { roundMoney, uniqueCurrencyPairs } from "./helpers";

async function getBalanceSheetImpl(
  db: Database,
  params: GetBalanceSheetParams,
): Promise<BalanceSheetResult> {
  const context = await loadBalanceSheetContext(db, params);
  const exchangeRateMap =
    (await getExchangeRatesBatch(db, {
      pairs: uniqueCurrencyPairs([
        ...getAssetCurrencyPairs(context),
        ...getLiabilityCurrencyPairs(context),
      ]),
    })) ?? new Map<string, number>();

  const [assets, liabilities, equity] = await Promise.all([
    buildBalanceSheetAssets(context, exchangeRateMap),
    buildBalanceSheetLiabilities(context, exchangeRateMap),
    buildBalanceSheetEquity(context),
  ]);

  const totalAssets = assets.total;
  const totalLiabilities = liabilities.total;
  const equityTotal = equity.total;
  const balanceDifference = totalAssets - (totalLiabilities + equityTotal);

  if (Math.abs(balanceDifference) > 0.01) {
    const adjustedRetainedEarnings = equity.retainedEarnings + balanceDifference;
    const adjustedEquityTotal =
      equity.capitalInvestment - equity.ownerDraws + adjustedRetainedEarnings;

    return {
      assets,
      liabilities,
      equity: {
        ...equity,
        retainedEarnings: roundMoney(adjustedRetainedEarnings),
        total: roundMoney(adjustedEquityTotal),
      },
      currency: context.currency,
    };
  }

  return {
    assets,
    liabilities,
    equity,
    currency: context.currency,
  };
}

export const getBalanceSheet = reuseQueryResult({
  keyPrefix: "balance-sheet",
  keyFn: (params: GetBalanceSheetParams) =>
    [params.teamId, params.currency ?? "", params.asOf ?? ""].join(":"),
  load: getBalanceSheetImpl,
});
