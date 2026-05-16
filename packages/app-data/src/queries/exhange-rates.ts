import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../client";

const RATE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const rateCache = new Map<string, { rates: Record<string, number>; ts: number }>();

export type ExchangeRateData = {
  base: string;
  target: string;
  rate: number;
  updatedAt: string;
};

export type UpsertExchangeRatesParams = {
  rates: ExchangeRateData[];
  batchSize?: number;
};

export type UpsertExchangeRatesBatchParams = {
  rates: ExchangeRateData[];
};

type ExchangeRateRow = {
  base: string;
  target: string;
  rate: number;
  updated_at: string;
};

function toExchangeRate(row: ExchangeRateRow): ExchangeRateData {
  return {
    base: row.base,
    target: row.target,
    rate: Number(row.rate),
    updatedAt: row.updated_at,
  };
}

function getExchangeRatesD1(db: Database) {
  return requireCloudflareD1Database(db);
}

async function upsertExchangeRatesInD1(
  d1: CloudflareD1DatabaseBinding,
  rates: ExchangeRateData[],
) {
  if (rates.length === 0) {
    return { processed: 0 };
  }

  const statements = rates.map((rate) =>
    d1
      .prepare(
        `insert into exchange_rates (
          base,
          target,
          rate,
          updated_at
        ) values (?, ?, ?, ?)
        on conflict(base, target) do update set
          rate = excluded.rate,
          updated_at = excluded.updated_at`,
      )
      .bind(rate.base, rate.target, rate.rate, rate.updatedAt),
  );

  await d1.batch(statements);

  return { processed: rates.length };
}

async function getExchangeRatesForTargetFromD1(
  d1: CloudflareD1DatabaseBinding,
  target: string,
): Promise<ExchangeRateData[]> {
  const { results = [] } = await d1
    .prepare(
      `select
        base,
        target,
        rate,
        updated_at
      from exchange_rates
      where target = ?
      order by base asc`,
    )
    .bind(target)
    .all<ExchangeRateRow>();

  return results.map(toExchangeRate);
}

export const upsertExchangeRates = async (db: Database, params: UpsertExchangeRatesParams) => {
  const { rates, batchSize = 1000 } = params;

  if (rates.length === 0) {
    return { totalProcessed: 0, batchesProcessed: 0 };
  }

  const d1 = getExchangeRatesD1(db);
  let totalProcessed = 0;
  let batchesProcessed = 0;

  for (let i = 0; i < rates.length; i += batchSize) {
    const batch = rates.slice(i, i + batchSize);

    await upsertExchangeRatesInD1(d1, batch);

    totalProcessed += batch.length;
    batchesProcessed += 1;
  }

  for (const { target } of rates) {
    rateCache.delete(target);
  }

  return {
    totalProcessed,
    batchesProcessed,
  };
};

export type GetExchangeRateParams = {
  base: string;
  target: string;
};

async function getRatesForTarget(_db: Database, target: string): Promise<Record<string, number>> {
  const cached = rateCache.get(target);
  if (cached && Date.now() - cached.ts < RATE_TTL_MS) {
    return cached.rates;
  }

  const rows = await getExchangeRatesForTargetFromD1(getExchangeRatesD1(_db), target);

  const rates: Record<string, number> = {};
  for (const row of rows) {
    if (row.base) {
      rates[row.base] = Number(row.rate);
    }
  }

  rateCache.set(target, { rates, ts: Date.now() });
  return rates;
}

export async function getExchangeRate(db: Database, params: GetExchangeRateParams) {
  const { base, target } = params;

  if (base === target) return { rate: 1 };

  const rates = await getRatesForTarget(db, target);
  const rate = rates[base];
  return rate !== undefined ? { rate } : undefined;
}

export type GetExchangeRatesBatchParams = {
  pairs: Array<{ base: string; target: string }>;
};

export async function getExchangeRatesBatch(db: Database, params: GetExchangeRatesBatchParams) {
  const { pairs } = params;

  if (pairs.length === 0) {
    return new Map<string, number>();
  }

  // Group by target currency (almost always a single target)
  const byTarget = new Map<string, string[]>();
  for (const { base, target } of pairs) {
    const list = byTarget.get(target) ?? [];
    list.push(base);
    byTarget.set(target, list);
  }

  const result = new Map<string, number>();

  for (const [target, bases] of byTarget) {
    const rates = await getRatesForTarget(db, target);
    for (const base of bases) {
      const rate = rates[base];
      if (rate !== undefined) {
        result.set(`${base}:${target}`, rate);
      }
    }
  }

  return result;
}
