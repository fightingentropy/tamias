import { UTCDate } from "@date-fns/utc";
import { endOfMonth, parseISO, startOfMonth, subYears } from "date-fns";
import type { Database } from "../../../client";
import { reuseQueryResult } from "../../../utils/request-cache";
import { getPercentageIncrease } from "../shared";
import { getProfit, getRevenue } from "./series";
import type { GetReportsParams } from "./shared";

async function getReportsImpl(db: Database, params: GetReportsParams) {
  const { teamId, from, to, type = "profit", currency: inputCurrency, revenueType } = params;

  const prevFromDate = subYears(startOfMonth(new UTCDate(parseISO(from))), 1);
  const prevToDate = subYears(endOfMonth(new UTCDate(parseISO(to))), 1);

  const reportFunction = type === "profit" ? getProfit : getRevenue;

  const [rawPrev, rawCurr] = await Promise.all([
    reportFunction(db, {
      teamId,
      from: prevFromDate.toISOString(),
      to: prevToDate.toISOString(),
      currency: inputCurrency,
      revenueType,
    }),
    reportFunction(db, {
      teamId,
      from,
      to,
      currency: inputCurrency,
      revenueType,
    }),
  ]);

  const prevData = rawPrev.map((item) => ({
    ...item,
    value: Number.parseFloat(item.value),
  }));

  const currentData = rawCurr.map((item) => ({
    ...item,
    value: Number.parseFloat(item.value),
  }));

  const prevTotal = Number(
    (prevData?.reduce((value, item) => item.value + value, 0) ?? 0).toFixed(2),
  );

  const currentTotal = Number(
    (currentData?.reduce((value, item) => item.value + value, 0) ?? 0).toFixed(2),
  );

  const baseCurrency = currentData?.at(0)?.currency ?? inputCurrency;

  return {
    summary: {
      currentTotal,
      prevTotal,
      currency: baseCurrency,
    },
    meta: {
      type,
      currency: baseCurrency,
    },
    result: currentData?.map((record, index) => {
      const prev = prevData?.at(index);
      const prevValue = prev?.value ?? 0;
      const recordValue = record.value;

      return {
        date: record.date,
        percentage: {
          value: Number(getPercentageIncrease(Math.abs(prevValue), Math.abs(recordValue)) || 0),
          status: recordValue > prevValue ? "positive" : "negative",
        },
        current: {
          date: record.date,
          value: recordValue,
          currency: record.currency,
        },
        previous: {
          date: prev?.date,
          value: prevValue,
          currency: prev?.currency ?? baseCurrency,
        },
      };
    }),
  };
}

export const getReports = reuseQueryResult({
  keyPrefix: "reports",
  keyFn: (params: GetReportsParams) => {
    const type = params.type ?? "profit";
    const revenueType = params.revenueType ?? (type === "profit" ? "net" : "gross");

    return [
      params.teamId,
      type,
      params.from,
      params.to,
      params.currency ?? "",
      revenueType,
      params.exactDates ?? false,
    ].join(":");
  },
  load: getReportsImpl,
});
