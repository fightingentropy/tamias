import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { createDatabase } from "../../../../client";
import type {
  CloudflareD1DatabaseBinding,
  CloudflareD1PreparedStatementBinding,
} from "../../../../client";
import {
  getInvoiceAggregateRowsFromD1,
  getInvoiceAgingAggregateRowsFromD1,
  getInvoiceAnalyticsAggregateRowsFromD1,
  getInvoiceCustomerDateAggregateRowsFromD1,
  getInvoiceDateAggregateRowsFromD1,
} from "./invoice-d1";
import {
  getTransactionMetricAggregateRowsFromD1,
  getTransactionRecurringAggregateRowsFromD1,
  getTransactionTaxAggregateRowsFromD1,
} from "./transaction-d1";

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
    resolve(import.meta.dir, "../../../../../../../api/migrations/d1/0037_report_aggregates.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    db: createDatabase({
      cloudflare: { d1 },
    }),
    sqlite,
    close: () => sqlite.close(),
  };
}

describe("report aggregate D1 reads", () => {
  test("reads transaction aggregates with team, scope, currency, direction, and date filters", async () => {
    const { db, sqlite, close } = createD1();

    try {
      sqlite
        .prepare(
          `insert into transaction_metric_aggregates (
            team_id,
            scope,
            date,
            currency,
            direction,
            category_slug,
            recurring,
            total_amount,
            total_net_amount,
            transaction_count,
            updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("team-1", "base", "2026-01-10", "GBP", "income", "sales", 0, 120, 100, 2, "now");
      sqlite
        .prepare(
          `insert into transaction_metric_aggregates (
            team_id,
            scope,
            date,
            currency,
            direction,
            category_slug,
            recurring,
            total_amount,
            total_net_amount,
            transaction_count,
            updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("team-1", "base", "2026-02-10", "GBP", "expense", "software", 1, -30, -30, 1, "now");
      sqlite
        .prepare(
          `insert into transaction_recurring_aggregates (
            team_id,
            scope,
            direction,
            currency,
            date,
            name,
            frequency,
            category_slug,
            total_amount,
            transaction_count,
            latest_amount,
            latest_transaction_created_at,
            updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "team-1",
          "base",
          "expense",
          "GBP",
          "2026-01-15",
          "Hosting",
          "monthly",
          "software",
          -50,
          2,
          -25,
          "2026-01-15T12:00:00.000Z",
          "now",
        );
      sqlite
        .prepare(
          `insert into transaction_tax_aggregates (
            team_id,
            scope,
            date,
            currency,
            direction,
            category_slug,
            tax_type,
            tax_rate,
            total_tax_amount,
            total_transaction_amount,
            transaction_count,
            updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "team-1",
          "base",
          "2026-01-10",
          "GBP",
          "income",
          "sales",
          "vat",
          20,
          20,
          120,
          2,
          "now",
        );

      await expect(
        getTransactionMetricAggregateRowsFromD1(db, {
          teamId: "team-1",
          scope: "base",
          currency: "GBP",
          dateFrom: "2026-01-01",
          dateTo: "2026-01-31",
        }),
      ).resolves.toMatchObject([
        {
          categorySlug: "sales",
          recurring: false,
          totalAmount: 120,
          totalNetAmount: 100,
          transactionCount: 2,
        },
      ]);

      await expect(
        getTransactionRecurringAggregateRowsFromD1(db, {
          teamId: "team-1",
          scope: "base",
          direction: "expense",
          currency: "GBP",
          dateFrom: "2026-01-01",
          dateTo: "2026-12-31",
        }),
      ).resolves.toMatchObject([
        {
          name: "Hosting",
          frequency: "monthly",
          latestAmount: -25,
        },
      ]);

      await expect(
        getTransactionTaxAggregateRowsFromD1(db, {
          teamId: "team-1",
          scope: "base",
          direction: "income",
          currency: "GBP",
          dateFrom: "2026-01-01",
          dateTo: "2026-01-31",
        }),
      ).resolves.toMatchObject([
        {
          taxType: "vat",
          taxRate: 20,
          totalTaxAmount: 20,
          totalTransactionAmount: 120,
        },
      ]);
    } finally {
      close();
    }
  });

  test("reads invoice aggregates with status, date, currency, recurring, and customer filters", async () => {
    const { db, sqlite, close } = createD1();

    try {
      sqlite
        .prepare(
          `insert into invoice_aggregates (
            team_id,
            scope_key,
            customer_id,
            status,
            currency,
            invoice_count,
            total_amount,
            oldest_due_date,
            latest_issue_date,
            updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("team-1", "team", null, "paid", "GBP", 3, 450, null, "2026-01-20", "now");
      sqlite
        .prepare(
          `insert into invoice_aggregates (
            team_id,
            scope_key,
            customer_id,
            status,
            currency,
            invoice_count,
            total_amount,
            oldest_due_date,
            latest_issue_date,
            updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "team-1",
          "customer:customer-1",
          "customer-1",
          "unpaid",
          "GBP",
          1,
          200,
          "2026-02-20",
          "2026-02-01",
          "now",
        );
      sqlite
        .prepare(
          `insert into invoice_date_aggregates (
            team_id,
            status,
            date_field,
            date,
            currency,
            recurring,
            invoice_count,
            total_amount,
            valid_payment_count,
            on_time_count,
            total_days_to_pay,
            updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("team-1", "paid", "issueDate", "2026-01-10", "GBP", 0, 2, 300, 0, 0, 0, "now");
      sqlite
        .prepare(
          `insert into invoice_customer_date_aggregates (
            team_id,
            customer_id,
            status,
            date_field,
            date,
            currency,
            invoice_count,
            total_amount,
            updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("team-1", "customer-1", "paid", "paidAt", "2026-01-25", "GBP", 1, 150, "now");
      sqlite
        .prepare(
          `insert into invoice_analytics_aggregates (
            team_id,
            date_field,
            date,
            status,
            currency,
            due_date,
            invoice_count,
            total_amount,
            issue_to_paid_valid_count,
            issue_to_paid_total_days,
            sent_to_paid_valid_count,
            sent_to_paid_total_days,
            updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "team-1",
          "paidAt",
          "2026-01-25",
          "paid",
          "GBP",
          "2026-01-30",
          1,
          150,
          1,
          15,
          1,
          10,
          "now",
        );
      sqlite
        .prepare(
          `insert into invoice_aging_aggregates (
            team_id,
            status,
            currency,
            issue_date,
            due_date,
            invoice_count,
            total_amount,
            updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("team-1", "unpaid", "GBP", "2026-02-01", "2026-02-20", 1, 200, "now");

      await expect(
        getInvoiceAggregateRowsFromD1(db, {
          teamId: "team-1",
          statuses: ["paid"],
        }),
      ).resolves.toMatchObject([{ status: "paid", currency: "GBP", totalAmount: 450 }]);

      await expect(
        getInvoiceAggregateRowsFromD1(db, {
          teamId: "team-1",
          customerId: "customer-1",
        }),
      ).resolves.toMatchObject([{ customerId: "customer-1", status: "unpaid" }]);

      await expect(
        getInvoiceDateAggregateRowsFromD1(db, {
          teamId: "team-1",
          statuses: ["paid", "unpaid"],
          dateField: "issueDate",
          dateFrom: "2026-01-01",
          dateTo: "2026-01-31",
          currency: "GBP",
          recurring: false,
        }),
      ).resolves.toMatchObject([{ status: "paid", recurring: false, invoiceCount: 2 }]);

      await expect(
        getInvoiceCustomerDateAggregateRowsFromD1(db, {
          teamId: "team-1",
          statuses: ["paid"],
          dateField: "paidAt",
          currency: "GBP",
        }),
      ).resolves.toMatchObject([{ customerId: "customer-1", totalAmount: 150 }]);

      await expect(
        getInvoiceAnalyticsAggregateRowsFromD1(db, {
          teamId: "team-1",
          statuses: ["paid"],
          dateField: "paidAt",
          dateFrom: "2026-01-01",
          dateTo: "2026-01-31",
          currency: "GBP",
        }),
      ).resolves.toMatchObject([{ dueDate: "2026-01-30", sentToPaidTotalDays: 10 }]);

      await expect(
        getInvoiceAgingAggregateRowsFromD1(db, {
          teamId: "team-1",
          statuses: ["unpaid", "overdue"],
          currency: "GBP",
        }),
      ).resolves.toMatchObject([{ dueDate: "2026-02-20", totalAmount: 200 }]);
    } finally {
      close();
    }
  });
});
