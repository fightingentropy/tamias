import {
  getTransactionMetricAggregateRowsFromConvex,
  getTransactionRecurringAggregateRowsFromConvex,
  getTransactionTaxAggregateRowsFromConvex,
} from "../../../../convex";
import type { Database } from "../../../../client";
import { createQueryCacheKey, getOrSetQueryCacheValue } from "../../../../client";
import type {
  ReportTransactionAggregateRow,
  ReportTransactionRecurringAggregateRow,
  ReportTransactionTaxAggregateRow,
} from "../types";
import { getTransactionAggregateScopeContext } from "./shared";

export async function getReportTransactionAggregateRows(
  db: Database,
  params: {
    teamId: string;
    from: string;
    to: string;
    inputCurrency?: string;
  },
) {
  return getOrSetQueryCacheValue(
    db,
    createQueryCacheKey("reports:transaction-aggregates", {
      teamId: params.teamId,
      from: params.from,
      to: params.to,
      inputCurrency: params.inputCurrency ?? null,
    }),
    async () => {
      const context = await getTransactionAggregateScopeContext(
        db,
        params.teamId,
        params.inputCurrency,
      );

      if (!context.currency || !context.scope) {
        return {
          targetCurrency: null,
          countryCode: context.countryCode,
          rows: [] as ReportTransactionAggregateRow[],
        };
      }

      const rows = await getTransactionMetricAggregateRowsFromConvex({
        teamId: params.teamId,
        scope: context.scope,
        currency: context.currency,
        dateFrom: params.from,
        dateTo: params.to,
      });

      return {
        targetCurrency: context.targetCurrency,
        countryCode: context.countryCode,
        rows,
      };
    },
  );
}

export async function getReportTransactionRecurringAggregateRows(
  db: Database,
  params: {
    teamId: string;
    direction: "income" | "expense";
    from?: string;
    to?: string;
    inputCurrency?: string;
  },
) {
  return getOrSetQueryCacheValue(
    db,
    createQueryCacheKey("reports:transaction-recurring-aggregates", {
      teamId: params.teamId,
      direction: params.direction,
      from: params.from ?? null,
      to: params.to ?? null,
      inputCurrency: params.inputCurrency ?? null,
    }),
    async () => {
      const context = await getTransactionAggregateScopeContext(
        db,
        params.teamId,
        params.inputCurrency,
      );

      if (!context.currency || !context.scope) {
        return {
          targetCurrency: null,
          countryCode: context.countryCode,
          rows: [] as ReportTransactionRecurringAggregateRow[],
        };
      }

      const rows = await getTransactionRecurringAggregateRowsFromConvex({
        teamId: params.teamId,
        scope: context.scope,
        direction: params.direction,
        currency: context.currency,
        dateFrom: params.from,
        dateTo: params.to,
      });

      return {
        targetCurrency: context.targetCurrency,
        countryCode: context.countryCode,
        rows,
      };
    },
  );
}

export async function getReportTransactionTaxAggregateRows(
  db: Database,
  params: {
    teamId: string;
    direction: "income" | "expense";
    from: string;
    to: string;
    inputCurrency?: string;
  },
) {
  return getOrSetQueryCacheValue(
    db,
    createQueryCacheKey("reports:transaction-tax-aggregates", {
      teamId: params.teamId,
      direction: params.direction,
      from: params.from,
      to: params.to,
      inputCurrency: params.inputCurrency ?? null,
    }),
    async () => {
      const context = await getTransactionAggregateScopeContext(
        db,
        params.teamId,
        params.inputCurrency,
      );

      if (!context.currency || !context.scope) {
        return {
          targetCurrency: null,
          countryCode: context.countryCode,
          rows: [] as ReportTransactionTaxAggregateRow[],
        };
      }

      const rows = await getTransactionTaxAggregateRowsFromConvex({
        teamId: params.teamId,
        scope: context.scope,
        direction: params.direction,
        currency: context.currency,
        dateFrom: params.from,
        dateTo: params.to,
      });

      return {
        targetCurrency: context.targetCurrency,
        countryCode: context.countryCode,
        rows,
      };
    },
  );
}
