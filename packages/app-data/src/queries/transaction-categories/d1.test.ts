import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import {
  createDatabase,
  type CloudflareD1DatabaseBinding,
  type CloudflareD1PreparedStatementBinding,
} from "../../client";
import {
  deleteTransactionCategoryRecord,
  getTransactionCategoryRecordById,
  listTransactionCategoryRecords,
  upsertTransactionCategoryRecord,
} from "./d1";

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
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0044_transaction_categories.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    db: createDatabase({
      cloudflare: { d1 },
    }),
    close: () => sqlite.close(),
  };
}

describe("transaction categories D1", () => {
  test("upserts, lists, reparents children, and deletes categories", async () => {
    const { db, close } = createD1();

    try {
      const parent = await upsertTransactionCategoryRecord(db, {
        id: "cat-parent",
        teamId: "team-1",
        name: "Revenue",
        slug: "revenue",
        color: "#0f766e",
        description: "Income",
        system: false,
        taxRate: 20,
        taxType: "vat",
        taxReportingCode: "sales",
        excluded: false,
      });
      const child = await upsertTransactionCategoryRecord(db, {
        id: "cat-child",
        teamId: "team-1",
        name: "Consulting",
        slug: "consulting",
        parentId: parent.id,
      });

      expect(child.parentId).toBe("cat-parent");

      await upsertTransactionCategoryRecord(db, {
        ...parent,
        name: "Revenue Updated",
        slug: "revenue",
        color: null,
        description: null,
        system: false,
        excluded: true,
      });

      await expect(
        getTransactionCategoryRecordById(db, {
          teamId: "team-1",
          id: "cat-parent",
        }),
      ).resolves.toMatchObject({
        id: "cat-parent",
        name: "Revenue Updated",
        color: null,
        excluded: true,
      });

      await expect(listTransactionCategoryRecords(db, "team-1")).resolves.toHaveLength(2);
      await expect(
        deleteTransactionCategoryRecord(db, {
          teamId: "team-1",
          id: "cat-parent",
        }),
      ).resolves.toEqual({ id: "cat-parent" });
      await expect(
        getTransactionCategoryRecordById(db, {
          teamId: "team-1",
          id: "cat-child",
        }),
      ).resolves.toMatchObject({
        id: "cat-child",
        parentId: null,
      });
    } finally {
      close();
    }
  });
});
