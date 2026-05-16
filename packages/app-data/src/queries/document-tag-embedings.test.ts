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
  createDocumentTagEmbedding,
  getDocumentTagEmbeddings,
  upsertDocumentTagEmbeddings,
} from "./document-tag-embedings";

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
    resolve(import.meta.dir, "../../../../api/migrations/d1/0026_document_tag_embeddings.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    db: createDatabase({ cloudflare: { d1 } }),
    close: () => sqlite.close(),
  };
}

describe("document tag embeddings D1", () => {
  test("creates, upserts, and reads embeddings by slug", async () => {
    const { db, close } = createD1();

    try {
      await expect(
        createDocumentTagEmbedding(db, {
          slug: "sales-contract",
          name: "Sales Contract",
          embedding: "[0.1,0.2]",
          model: "test-model",
        }),
      ).resolves.toMatchObject({
        slug: "sales-contract",
        name: "Sales Contract",
        embedding: [0.1, 0.2],
        model: "test-model",
      });

      await expect(
        upsertDocumentTagEmbeddings(db, [
          {
            slug: "sales-contract",
            name: "Sales Contract Updated",
            embedding: [0.3],
            model: "test-model-2",
          },
          {
            slug: "receipt",
            name: "Receipt",
            embedding: [0.9],
            model: "test-model",
          },
        ]),
      ).resolves.toEqual([
        expect.objectContaining({
          slug: "sales-contract",
          name: "Sales Contract Updated",
          embedding: [0.3],
        }),
        expect.objectContaining({
          slug: "receipt",
          name: "Receipt",
          embedding: [0.9],
        }),
      ]);

      await expect(
        getDocumentTagEmbeddings(db, {
          slugs: ["receipt", "missing", "sales-contract"],
        }),
      ).resolves.toEqual([
        expect.objectContaining({ slug: "receipt", embedding: [0.9] }),
        expect.objectContaining({ slug: "sales-contract", embedding: [0.3] }),
      ]);
    } finally {
      close();
    }
  });
});
