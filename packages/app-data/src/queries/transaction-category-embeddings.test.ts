import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import {
  createDatabase,
  type CloudflareD1DatabaseBinding,
  type CloudflareD1PreparedStatementBinding,
} from "../client";
import {
  getCategoryEmbedding,
  getCategoryEmbeddingsByNames,
  upsertCategoryEmbedding,
} from "./transaction-category-embeddings";

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
    resolve(
      import.meta.dir,
      "../../../../api/migrations/d1/0025_transaction_category_embeddings.sql",
    ),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    db: createDatabase({ cloudflare: { d1 } }),
    close: () => sqlite.close(),
  };
}

describe("transaction category embeddings D1", () => {
  test("upserts, overwrites, and reads embeddings by name", async () => {
    const { db, close } = createD1();

    try {
      await expect(
        upsertCategoryEmbedding(db, {
          name: "Travel",
          embedding: [0.1, 0.2, 0.3],
          system: true,
          model: "test-model",
        }),
      ).resolves.toMatchObject({
        name: "Travel",
        embedding: [0.1, 0.2, 0.3],
        system: true,
        model: "test-model",
      });

      await expect(getCategoryEmbedding(db, { name: "Travel" })).resolves.toMatchObject({
        name: "Travel",
        embedding: [0.1, 0.2, 0.3],
        system: true,
        model: "test-model",
      });

      await expect(
        upsertCategoryEmbedding(db, {
          name: "Travel",
          embedding: [0.4, 0.5],
        }),
      ).resolves.toMatchObject({
        name: "Travel",
        embedding: [0.4, 0.5],
        system: false,
        model: "gemini-embedding-001",
      });

      await upsertCategoryEmbedding(db, {
        name: "Software",
        embedding: [0.9],
        system: true,
      });

      await expect(
        getCategoryEmbeddingsByNames(db, {
          names: ["Software", "Missing", "Travel"],
        }),
      ).resolves.toEqual([
        expect.objectContaining({ name: "Software", embedding: [0.9] }),
        expect.objectContaining({ name: "Travel", embedding: [0.4, 0.5] }),
      ]);
    } finally {
      close();
    }
  });
});
