import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { createDatabase } from "../../client";
import type {
  CloudflareD1DatabaseBinding,
  CloudflareD1PreparedStatementBinding,
} from "../../client";
import {
  createInvoiceRecurring,
  deleteInvoiceRecurring,
  markInvoiceGenerated,
  pauseInvoiceRecurring,
  updateInvoiceRecurring,
} from "./mutations";
import { getInvoiceRecurringById, getInvoiceRecurringList } from "./reads";
import { getDueInvoiceRecurring, getUpcomingDueRecurring } from "./scheduling";
import { requireInvoiceRecurringD1 } from "./d1";

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
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0033_invoice_recurring_series.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    d1,
    close: () => sqlite.close(),
  };
}

function createRecurringDb(d1: CloudflareD1DatabaseBinding) {
  return createDatabase({
    cloudflare: { d1 },
  });
}

describe("invoice recurring D1", () => {
  test("requires a Cloudflare D1 binding", () => {
    expect(() => requireInvoiceRecurringD1(createDatabase())).toThrow(
      "Invoice recurring series require Cloudflare D1",
    );
  });

  test("creates, reads, lists, schedules, and cancels recurring series in D1", async () => {
    const { d1, close } = createD1();
    const db = createRecurringDb(d1);

    try {
      const recurring = await createInvoiceRecurring(db, {
        teamId: "team-1",
        userId: "user-1",
        customerName: "Acme Ltd",
        frequency: "monthly_date",
        frequencyDay: 15,
        endType: "after_count",
        endCount: 3,
        timezone: "UTC",
        amount: 1200,
        currency: "GBP",
        lineItems: [{ name: "Retainer", quantity: 1, price: 1200 }],
        template: { title: "Invoice" },
        issueDate: "2026-01-01T00:00:00.000Z",
      });

      expect(recurring).toMatchObject({
        teamId: "team-1",
        userId: "user-1",
        customerName: "Acme Ltd",
        frequency: "monthly_date",
        frequencyDay: 15,
        status: "active",
        invoicesGenerated: 0,
        amount: 1200,
        currency: "GBP",
        customer: {
          id: null,
          name: null,
          email: null,
        },
      });

      await expect(
        getInvoiceRecurringById(db, {
          id: recurring.id,
          teamId: "team-1",
        }),
      ).resolves.toMatchObject({
        id: recurring.id,
        lineItems: [{ name: "Retainer", quantity: 1, price: 1200 }],
      });

      await expect(
        getInvoiceRecurringList(db, {
          teamId: "team-1",
          status: ["active"],
        }),
      ).resolves.toMatchObject({
        data: [{ id: recurring.id, customerName: "Acme Ltd" }],
        meta: { hasNextPage: false },
      });

      const dueAt = "2000-01-01T00:00:00.000Z";
      await updateInvoiceRecurring(db, {
        id: recurring.id,
        teamId: "team-1",
        nextScheduledAt: dueAt,
        amount: 1500,
      });

      await expect(getDueInvoiceRecurring(db)).resolves.toMatchObject({
        data: [{ id: recurring.id, nextScheduledAt: dueAt, amount: 1500 }],
        hasMore: false,
      });

      const generated = await markInvoiceGenerated(db, {
        id: recurring.id,
        teamId: "team-1",
      });

      expect(generated).toMatchObject({
        id: recurring.id,
        invoicesGenerated: 1,
        status: "active",
      });
      expect(generated?.lastGeneratedAt).toEqual(expect.any(String));

      const upcoming = await createInvoiceRecurring(db, {
        teamId: "team-1",
        userId: "user-1",
        customerName: "Future Co",
        frequency: "weekly",
        endType: "never",
        timezone: "UTC",
        amount: 300,
        currency: "GBP",
      });
      const upcomingAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await updateInvoiceRecurring(db, {
        id: upcoming.id,
        teamId: "team-1",
        nextScheduledAt: upcomingAt,
      });

      await expect(getUpcomingDueRecurring(db, 2)).resolves.toMatchObject({
        data: [{ id: upcoming.id, nextScheduledAt: upcomingAt }],
        hasMore: false,
      });

      await pauseInvoiceRecurring(db, {
        id: upcoming.id,
        teamId: "team-1",
      });
      await expect(getUpcomingDueRecurring(db, 2)).resolves.toMatchObject({
        data: [],
        hasMore: false,
      });

      await deleteInvoiceRecurring(db, {
        id: recurring.id,
        teamId: "team-1",
      });
      await expect(
        getInvoiceRecurringById(db, {
          id: recurring.id,
          teamId: "team-1",
        }),
      ).resolves.toMatchObject({
        id: recurring.id,
        status: "canceled",
        nextScheduledAt: null,
      });
    } finally {
      close();
    }
  });
});
