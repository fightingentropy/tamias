import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { UTCDate } from "@date-fns/utc";
import type { Database } from "../../../client";
import { reuseQueryResult } from "../../../utils/request-cache";
import { getCashBalance } from "../../bank-accounts";
import { getTargetCurrency } from "../shared";
import { getBurnRate } from "./burn-rate";

export type GetRunwayParams = {
  teamId: string;
  currency?: string;
};

async function getRunwayImpl(db: Database, params: GetRunwayParams) {
  const toDate = endOfMonth(new UTCDate());
  const fromDate = startOfMonth(subMonths(toDate, 5));
  const burnRateFrom = format(fromDate, "yyyy-MM-dd");
  const burnRateTo = format(toDate, "yyyy-MM-dd");
  const targetCurrency = await getTargetCurrency(db, params.teamId, params.currency);

  if (!targetCurrency) {
    return 0;
  }

  const [cashBalance, burnRateData] = await Promise.all([
    getCashBalance(db, {
      teamId: params.teamId,
      currency: targetCurrency,
    }),
    getBurnRate(db, {
      teamId: params.teamId,
      from: burnRateFrom,
      to: burnRateTo,
      currency: params.currency,
    }),
  ]);
  const totalBalance = cashBalance.totalBalance || 0;

  if (burnRateData.length === 0) {
    return 0;
  }

  const totalBurnRate = burnRateData.reduce((sum, item) => sum + item.value, 0);
  const avgBurnRate = Math.round(totalBurnRate / burnRateData.length);

  if (avgBurnRate === 0) {
    return 0;
  }

  return Math.round(totalBalance / avgBurnRate);
}

export const getRunway = reuseQueryResult({
  keyPrefix: "runway",
  keyFn: (params: GetRunwayParams) => [params.teamId, params.currency ?? ""].join(":"),
  load: getRunwayImpl,
});
