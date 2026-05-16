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
  createInvoiceProduct,
  deleteInvoiceProduct,
  getInvoiceProductById,
  getInvoiceProducts,
  incrementProductUsage,
  updateInvoiceProduct,
  upsertInvoiceProduct,
} from "../invoice-products";
import { getInvoiceProductByIdFromD1, upsertInvoiceProductRecordInD1 } from "./d1";

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
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0018_invoice_products.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    d1,
    close: () => sqlite.close(),
  };
}

describe("invoice products D1", () => {
  test("serves product CRUD from D1", async () => {
    const { d1, close } = createD1();
    const db = createDatabase({
      cloudflare: { d1 },
    });

    try {
      const created = await createInvoiceProduct(db, {
        teamId: "team-1",
        createdBy: "user-1" as never,
        name: "Consulting",
        description: "Initial",
        price: 100,
        currency: "GBP",
        unit: "hour",
      });

      expect(created).toMatchObject({
        teamId: "team-1",
        name: "Consulting",
        price: 100,
        currency: "GBP",
        usageCount: 0,
        isActive: true,
      });

      const upserted = await upsertInvoiceProduct(db, {
        teamId: "team-1",
        createdBy: "user-1" as never,
        name: "Consulting",
        description: "Updated",
        price: 100,
        currency: "GBP",
        unit: "hour",
      });

      expect(upserted.id).toBe(created.id);
      expect(upserted.description).toBe("Updated");
      expect(upserted.usageCount).toBe(1);

      const updated = await updateInvoiceProduct(db, {
        id: created.id,
        teamId: "team-1",
        name: "Consulting Pro",
        price: 120,
      });

      expect(updated).toMatchObject({
        id: created.id,
        name: "Consulting Pro",
        price: 120,
      });

      await incrementProductUsage(db, created.id, "team-1");

      const found = await getInvoiceProductById(db, created.id, "team-1");
      expect(found?.usageCount).toBe(2);

      const products = await getInvoiceProducts(db, "team-1", {
        sortBy: "popular",
        includeInactive: false,
      });

      expect(products.map((product) => product.id)).toEqual([created.id]);

      await expect(deleteInvoiceProduct(db, created.id, "team-1")).resolves.toBe(true);
      await expect(getInvoiceProducts(db, "team-1")).resolves.toEqual([]);
    } finally {
      close();
    }
  });

  test("replaces a row with the same product key when the incoming id differs", async () => {
    const { d1, close } = createD1();

    try {
      await upsertInvoiceProductRecordInD1(d1, {
        id: "previous-product",
        createdAt: "2026-05-15T10:00:00.000Z",
        updatedAt: "2026-05-15T10:00:00.000Z",
        teamId: "team-1",
        createdBy: "user-1" as never,
        name: "Consulting",
        description: null,
        price: 100,
        currency: "GBP",
        unit: "hour",
        taxRate: null,
        isActive: true,
        usageCount: 1,
        lastUsedAt: "2026-05-15T10:00:00.000Z",
      });

      await upsertInvoiceProductRecordInD1(d1, {
        id: "replacement-product",
        createdAt: "2026-05-15T10:01:00.000Z",
        updatedAt: "2026-05-15T10:01:00.000Z",
        teamId: "team-1",
        createdBy: "user-1" as never,
        name: "Consulting",
        description: "Authoritative",
        price: 100,
        currency: "GBP",
        unit: "hour",
        taxRate: null,
        isActive: true,
        usageCount: 3,
        lastUsedAt: "2026-05-15T10:01:00.000Z",
      });

      await expect(getInvoiceProductByIdFromD1(d1, "previous-product", "team-1")).resolves.toBe(
        null,
      );
      await expect(
        getInvoiceProductByIdFromD1(d1, "replacement-product", "team-1"),
      ).resolves.toMatchObject({
        id: "replacement-product",
        description: "Authoritative",
        usageCount: 3,
      });
    } finally {
      close();
    }
  });
});
