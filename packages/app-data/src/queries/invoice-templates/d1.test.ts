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
  createInvoiceTemplate,
  deleteInvoiceTemplate,
  getInvoiceTemplate,
  getInvoiceTemplateById,
  getInvoiceTemplateCount,
  getInvoiceTemplates,
  setDefaultTemplate,
  upsertInvoiceTemplate,
} from "../invoice-templates";

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
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0019_invoice_templates.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    d1,
    close: () => sqlite.close(),
  };
}

describe("invoice templates D1", () => {
  test("preserves template defaults, upserts, reads, counts, and delete behavior", async () => {
    const { d1, close } = createD1();
    const db = createDatabase({
      cloudflare: { d1 },
    });

    try {
      const first = await createInvoiceTemplate(db, {
        teamId: "team-1",
        name: "Default",
        currency: "GBP",
        paymentTermsDays: 30,
      });
      const second = await createInvoiceTemplate(db, {
        teamId: "team-1",
        name: "Secondary",
        isDefault: true,
        currency: "USD",
        paymentTermsDays: 14,
      });

      expect(first.isDefault).toBe(true);
      expect(second.isDefault).toBe(true);
      await expect(getInvoiceTemplate(db, "team-1")).resolves.toMatchObject({
        id: second.id,
        currency: "USD",
      });

      await expect(getInvoiceTemplates(db, "team-1")).resolves.toMatchObject([
        { id: second.id, isDefault: true },
        { id: first.id, isDefault: false },
      ]);
      await expect(getInvoiceTemplateCount(db, "team-1")).resolves.toBe(2);

      const updated = await upsertInvoiceTemplate(db, {
        id: first.id,
        teamId: "team-1",
        name: "Primary",
        paymentTermsDays: 45,
      });

      expect(updated).toMatchObject({
        id: first.id,
        name: "Primary",
        paymentTermsDays: 45,
      });

      await setDefaultTemplate(db, {
        id: first.id,
        teamId: "team-1",
      });

      await expect(
        getInvoiceTemplateById(db, { id: first.id, teamId: "team-1" }),
      ).resolves.toMatchObject({
        id: first.id,
        isDefault: true,
      });

      const deleted = await deleteInvoiceTemplate(db, {
        id: first.id,
        teamId: "team-1",
      });

      expect(deleted).toMatchObject({
        deleted: { id: first.id },
        newDefault: { id: second.id, isDefault: true },
      });
      await expect(getInvoiceTemplates(db, "team-1")).resolves.toEqual([
        expect.objectContaining({ id: second.id, isDefault: true }),
      ]);
    } finally {
      close();
    }
  });
});
