import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import {
  createDatabase,
  type CloudflareD1DatabaseBinding,
  type CloudflareD1PreparedStatementBinding,
} from "../client";
import { getExchangeRate, getExchangeRatesBatch, upsertExchangeRates } from "./exhange-rates";

class SqliteD1Statement implements CloudflareD1PreparedStatementBinding {
  constructor(
    private readonly statement: ReturnType<SqliteDatabase["prepare"]>,
    private readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new SqliteD1Statement(this.statement, values);
  }

  async first<T = unknown>(columnName?: string) {
    const row = (this.statement as any).get(...this.values) as Record<string, unknown> | null;

    if (columnName) {
      return (row?.[columnName] ?? null) as T | null;
    }

    return row as T | null;
  }

  async all<T = unknown>() {
    return {
      results: (this.statement as any).all(...this.values) as T[],
      success: true,
    };
  }

  async run<T = unknown>() {
    (this.statement as any).run(...this.values);

    return {
      results: [] as T[],
      success: true,
    };
  }

  async raw<T = unknown[]>() {
    return (this.statement as any).values(...this.values) as T[];
  }
}

class SqliteD1Database implements CloudflareD1DatabaseBinding {
  constructor(private readonly db: SqliteDatabase) {}

  prepare(query: string) {
    return new SqliteD1Statement(this.db.prepare(query));
  }

  async batch<T = unknown>(statements: CloudflareD1PreparedStatementBinding[]) {
    const results = [];

    for (const statement of statements) {
      results.push(await statement.run<T>());
    }

    return results;
  }

  async exec(query: string) {
    this.db.exec(query);

    return {
      count: 0,
      duration: 0,
    };
  }
}

function createD1() {
  const sqlite = new SqliteDatabase(":memory:");
  const d1 = new SqliteD1Database(sqlite);
  const migration = readFileSync(
    resolve(import.meta.dir, "../../../../api/migrations/d1/0023_exchange_rates.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    db: createDatabase({ cloudflare: { d1 } }),
    close: () => sqlite.close(),
  };
}

describe("exchange rates D1", () => {
  test("upserts, overwrites, and reads rates by target", async () => {
    const { db, close } = createD1();

    try {
      const firstWrite = await upsertExchangeRates(db, {
        batchSize: 2,
        rates: [
          {
            base: "USD",
            target: "GBP",
            rate: 0.79,
            updatedAt: "2026-05-15T10:00:00.000Z",
          },
          {
            base: "EUR",
            target: "GBP",
            rate: 0.86,
            updatedAt: "2026-05-15T10:00:00.000Z",
          },
          {
            base: "USD",
            target: "EUR",
            rate: 0.92,
            updatedAt: "2026-05-15T10:00:00.000Z",
          },
        ],
      });

      expect(firstWrite).toEqual({ totalProcessed: 3, batchesProcessed: 2 });
      await expect(getExchangeRate(db, { base: "USD", target: "GBP" })).resolves.toEqual({
        rate: 0.79,
      });
      await expect(getExchangeRate(db, { base: "GBP", target: "GBP" })).resolves.toEqual({
        rate: 1,
      });

      await upsertExchangeRates(db, {
        rates: [
          {
            base: "USD",
            target: "GBP",
            rate: 0.8,
            updatedAt: "2026-05-15T11:00:00.000Z",
          },
        ],
      });

      await expect(getExchangeRate(db, { base: "USD", target: "GBP" })).resolves.toEqual({
        rate: 0.8,
      });

      const batch = await getExchangeRatesBatch(db, {
        pairs: [
          { base: "USD", target: "GBP" },
          { base: "EUR", target: "GBP" },
          { base: "JPY", target: "GBP" },
          { base: "USD", target: "EUR" },
        ],
      });

      expect(Array.from(batch.entries())).toEqual([
        ["USD:GBP", 0.8],
        ["EUR:GBP", 0.86],
        ["USD:EUR", 0.92],
      ]);
    } finally {
      close();
    }
  });
});
