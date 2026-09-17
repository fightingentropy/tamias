import { Database as SQLite, type SQLQueryBindings } from "bun:sqlite";
import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  createDatabase,
  type CloudflareD1DatabaseBinding,
  type CloudflareD1PreparedStatementBinding,
} from "../../../client";
import { upsertTransactionsInD1 } from "../d1";
import { updateTransaction, updateTransactions } from "./update";

test("category and note edits preserve stored status and amounts in D1", async () => {
  const sqlite = new SQLite(":memory:");
  const migrations = resolve(import.meta.dir, "../../../../../../api/migrations/d1");
  for (const file of readdirSync(migrations)
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    sqlite.exec(readFileSync(resolve(migrations, file), "utf8"));
  }
  sqlite.exec(
    "insert into teams (id,name,base_currency,created_at,updated_at) values ('test-team','Test','GBP','2026-01-01','2026-01-01')",
  );

  class Statement implements CloudflareD1PreparedStatementBinding {
    constructor(
      readonly sql: string,
      readonly values: SQLQueryBindings[] = [],
    ) {}
    bind(...values: unknown[]) {
      if (values.some((value) => value === undefined)) {
        throw new Error("D1_TYPE_ERROR: undefined is not supported");
      }
      return new Statement(this.sql, values as SQLQueryBindings[]);
    }
    async first<T>(column?: string) {
      const row = sqlite.query(this.sql).get(...this.values) as Record<string, unknown> | null;
      return (column ? (row?.[column] ?? null) : row) as T | null;
    }
    async all<T>() {
      return { success: true, results: sqlite.query(this.sql).all(...this.values) as T[] };
    }
    async run<T>() {
      return this.all<T>();
    }
    async raw<T>() {
      return sqlite.query(this.sql).values(...this.values) as T[];
    }
  }
  const d1: CloudflareD1DatabaseBinding = {
    prepare: (sql) => new Statement(sql),
    batch: async <T>(statements: CloudflareD1PreparedStatementBinding[]) =>
      Promise.all(statements.map((statement) => statement.all<T>())),
    exec: async (sql) => {
      sqlite.exec(sql);
      return { count: 0, duration: 0 };
    },
  };
  const db = createDatabase({ cloudflare: { d1 } });
  try {
    await upsertTransactionsInD1(d1, {
      teamId: "test-team",
      transactions: ["posted", "completed"].map((status, index) => ({
        id: `tx-${index}`,
        internalId: `import-${index}`,
        createdAt: "2026-01-01",
        date: "2026-03-01",
        name: "Example shop",
        method: "card_purchase" as const,
        amount: -12.34,
        currency: "GBP",
        status: status as "posted" | "completed",
        manual: true,
        categorySlug: "equipment",
        taxRate: 20,
        taxAmount: 2.06,
      })),
    });
    const updated = await updateTransactions(db, {
      teamId: "test-team",
      ids: ["tx-0", "tx-1"],
      categorySlug: null,
    });
    expect(updated.sort((a, b) => a.id.localeCompare(b.id)).map((row) => row.status)).toEqual([
      "posted",
      "completed",
    ]);
    expect(
      sqlite
        .query("select status, amount, category_slug, tax_amount from transactions order by id")
        .all(),
    ).toEqual([
      { status: "posted", amount: -12.34, category_slug: null, tax_amount: null },
      { status: "completed", amount: -12.34, category_slug: null, tax_amount: null },
    ]);
    await updateTransaction(db, {
      teamId: "test-team",
      id: "tx-0",
      note: "Receipt needs review",
      status: null,
    });
    expect(
      sqlite.query("select status, amount, note from transactions where id='tx-0'").get(),
    ).toEqual({
      status: "posted",
      amount: -12.34,
      note: "Receipt needs review",
    });
    await updateTransaction(db, { teamId: "test-team", id: "tx-0", status: "excluded" });
    expect(sqlite.query("select status from transactions where id='tx-0'").get()).toEqual({
      status: "excluded",
    });
  } finally {
    sqlite.close();
  }
});
