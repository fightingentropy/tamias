import { Database as SQLite, type SQLQueryBindings } from "bun:sqlite";
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createDatabase,
  type CloudflareD1DatabaseBinding,
  type CloudflareD1PreparedStatementBinding,
} from "../../client";
import { getStatementAnalytics } from "./statement";
import { getSpending } from "./metrics-spending/spending";

class Statement implements CloudflareD1PreparedStatementBinding {
  constructor(
    readonly sqlite: SQLite,
    readonly sql: string,
    readonly values: SQLQueryBindings[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new Statement(this.sqlite, this.sql, values as SQLQueryBindings[]);
  }
  async first<T>(column?: string) {
    const row = this.sqlite.query(this.sql).get(...this.values) as Record<string, unknown> | null;
    return (column ? (row?.[column] ?? null) : row) as T | null;
  }
  async all<T>() {
    return { success: true, results: this.sqlite.query(this.sql).all(...this.values) as T[] };
  }
  async run<T>() {
    return this.all<T>();
  }
  async raw<T>() {
    return this.sqlite.query(this.sql).values(...this.values) as T[];
  }
}
function setup() {
  const sqlite = new SQLite(":memory:");
  for (const migration of [
    "0020_identity_core.sql",
    "0037_report_aggregates.sql",
    "0044_transaction_categories.sql",
    "0047_transactions.sql",
  ]) {
    sqlite.exec(
      readFileSync(
        resolve(import.meta.dir, `../../../../../api/migrations/d1/${migration}`),
        "utf8",
      ),
    );
  }
  sqlite.exec(
    "INSERT INTO teams (id, name, base_currency, created_at, updated_at) VALUES ('statement-a', 'Example', 'GBP', 'now', 'now')",
  );
  const d1: CloudflareD1DatabaseBinding = {
    prepare: (sql) => new Statement(sqlite, sql),
    async batch<T>(statements: CloudflareD1PreparedStatementBinding[]) {
      return Promise.all(statements.map((statement) => statement.all<T>()));
    },
    async exec(sql) {
      sqlite.exec(sql);
      return { count: 0, duration: 0 };
    },
  };
  function insert(id: string, amount: number, extra: Record<string, SQLQueryBindings> = {}) {
    const row = {
      id,
      team_id: "statement-a",
      created_at: "now",
      updated_at: "now",
      date: "2025-07-01",
      name: id,
      method: "transfer",
      amount,
      currency: "GBP",
      bank_account_id: "account-a",
      internal_id: id,
      status: "posted",
      manual: 1,
      ...extra,
    };
    sqlite
      .query(
        `INSERT INTO transactions (${Object.keys(row).join(",")}) VALUES (${Object.keys(row)
          .map(() => "?")
          .join(",")})`,
      )
      .run(...Object.values(row));
  }
  function category(slug: string, name: string, team = "statement-a", excluded = 0) {
    sqlite
      .query(
        "INSERT INTO transaction_categories (id,team_id,slug,name,excluded,created_at,updated_at) VALUES (?,?,?,?,?,'now','now')",
      )
      .run(`${team}-${slug}`, team, slug, name, excluded);
  }
  return { db: createDatabase({ cloudflare: { d1 } }), sqlite, insert, category };
}

test("statement totals reconcile exact dates and accounts, without tax checks, transfers or FX double counting", async () => {
  const { db, sqlite, insert, category } = setup();
  try {
    category("tools", "Tools & equipment");
    category("tools", "Private other-team category", "other");
    category("excluded-category", "Excluded", "statement-a", 1);
    insert("salary", 1000, { date: "2025-04-06" });
    insert("refund", 10, { category_slug: "tools" });
    insert("Tool shop", -100, { category_slug: "tools" });
    insert("Unknown purchase", -25);
    insert("pass through in", 200, { category_slug: "transfer" });
    insert("pass through out", -200, { category_slug: "transfer" });
    insert("internal", -40, { internal: 1 });
    insert("excluded", -20, { category_slug: "excluded-category" });
    insert("Foreign shop", -50, {
      date: "2026-04-05",
      currency: "USD",
      base_currency: "GBP",
      base_amount: -40,
      category_slug: "shopping",
    });
    insert("Unconverted", -100, { currency: "EUR" });
    insert("before", -11, { date: "2025-04-05" });
    insert("after", -12, { date: "2026-04-06" });
    insert("other account", -15, { bank_account_id: "account-b" });
    insert("private", -500, { team_id: "other" });
    for (const status of ["pending", "archived", "excluded"])
      insert(`status-${status}`, -800, { status });
    const result = await getStatementAnalytics(db, {
      teamId: "statement-a",
      from: "2025-04-06",
      to: "2026-04-05",
      accountId: "account-a",
    });
    expect(result.summary).toMatchObject({
      count: 9,
      firstDate: "2025-04-06",
      lastDate: "2026-04-05",
      moneyIn: 1210,
      moneyOut: 425,
      netMovement: 785,
      spending: 165,
      transfersIn: 200,
      transfersOut: 240,
      excludedOut: 20,
      uncategorizedCount: 1,
      unconvertedCount: 1,
      unconvertedCurrencies: "EUR",
    });
    expect(result.categories.reduce((sum, row) => sum + row.amount, 0)).toBe(165);
    expect(result.months.reduce((sum, row) => sum + row.moneyIn, 0)).toBe(1210);
    expect(result.months.reduce((sum, row) => sum + row.moneyOut, 0)).toBe(425);
    expect(result.categories.find((row) => row.slug === "tools")?.name).toBe("Tools & equipment");
    expect(result.merchants.map((row) => row.name)).toEqual([
      "Tool shop",
      "Foreign shop",
      "Unknown purchase",
    ]);
    expect(JSON.stringify(result)).not.toContain("Private other-team");
    const all = await getStatementAnalytics(db, { teamId: "statement-a" });
    expect(all.summary).toMatchObject({ count: 12, moneyOut: 463 });
    const usd = await getStatementAnalytics(db, { teamId: "statement-a", currency: "USD" });
    expect(usd.summary).toMatchObject({ count: 1, moneyOut: 50, spending: 50 });
    const foreignAccount = await getStatementAnalytics(db, {
      teamId: "other",
      accountId: "account-b",
      currency: "GBP",
    });
    expect(foreignAccount.summary.count).toBe(0);
  } finally {
    sqlite.close();
  }
});

test("statement analytics includes every imported record beyond a normal transaction page", async () => {
  const { db, sqlite, insert } = setup();
  try {
    for (let i = 0; i < 351; i++) insert(`purchase-${i}`, -0.1);
    const result = await getStatementAnalytics(db, { teamId: "statement-a" });
    expect(result.summary).toMatchObject({
      count: 351,
      moneyOut: 35.1,
      spending: 35.1,
      netMovement: -35.1,
    });
    expect(result.categories[0]).toMatchObject({ amount: 35.1, percentage: 100, count: 351 });
    const empty = await getStatementAnalytics(db, { teamId: "statement-a", from: "2026-04-06" });
    expect(empty.summary).toMatchObject({ count: 0, moneyIn: 0, moneyOut: 0, spending: 0 });
    expect(empty.months).toEqual([]);
  } finally {
    sqlite.close();
  }
});

test("broker cash movements and money forwarded for others are transfers", async () => {
  const { db, sqlite, insert, category } = setup();
  try {
    category("funds-held-for-others", "Money forwarded for others", "statement-a", 1);
    for (const slug of ["investment-movements", "funds-held-for-others"]) {
      insert(`${slug}-in`, 500, { category_slug: slug });
      insert(`${slug}-out`, -500, { category_slug: slug });
    }
    const result = await getStatementAnalytics(db, { teamId: "statement-a" });
    expect(result.summary).toMatchObject({
      count: 4,
      moneyIn: 1000,
      moneyOut: 1000,
      transfersIn: 1000,
      transfersOut: 1000,
      excludedIn: 0,
      excludedOut: 0,
      spending: 0,
    });
    expect(result.categories).toEqual([]);
  } finally {
    sqlite.close();
  }
});

test("excluded transfer categories never reappear as uncategorized spending", async () => {
  const { db, sqlite } = setup();
  try {
    for (const [slug, amount] of [
      ["office", -75],
      [null, -25],
      ["internal-transfer", -900],
    ] as const) {
      sqlite
        .query(
          `INSERT INTO transaction_metric_aggregates (team_id,scope,date,currency,direction,category_slug,recurring,total_amount,total_net_amount,transaction_count,updated_at) VALUES ('statement-a','base','2025-07-01','GBP','expense',?,0,?,?,1,'now')`,
        )
        .run(slug, amount, amount);
    }
    const result = await getSpending(db, {
      teamId: "statement-a",
      from: "2025-07-01",
      to: "2025-07-31",
      currency: "GBP",
    });
    expect(
      result.map((row) => ({ slug: row.slug, amount: row.amount, percentage: row.percentage })),
    ).toEqual([
      { slug: "office", amount: 75, percentage: 75 },
      { slug: "uncategorized", amount: 25, percentage: 25 },
    ]);
  } finally {
    sqlite.close();
  }
});
