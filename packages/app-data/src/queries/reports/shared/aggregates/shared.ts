import type { Database } from "../../../../client";
import { getTeamReportContext } from "../context";
import type { ProjectedInvoiceRecord } from "../../../invoice-projections";

export async function getTransactionAggregateScopeContext(
  db: Database,
  teamId: string,
  inputCurrency?: string,
) {
  const context = await getTeamReportContext(db, teamId, inputCurrency);

  if (!context.currency) {
    return {
      targetCurrency: null,
      countryCode: context.countryCode,
      scope: null,
      currency: null,
    };
  }

  return {
    targetCurrency: context.currency,
    countryCode: context.countryCode,
    scope:
      !inputCurrency || context.currency === context.baseCurrency
        ? ("base" as const)
        : ("native" as const),
    currency: context.currency,
  };
}

export function normalizeReportInvoiceStatuses(statuses?: ProjectedInvoiceRecord["status"][]) {
  if (!statuses || statuses.length === 0) {
    return null;
  }

  return [...new Set(statuses)].sort();
}
