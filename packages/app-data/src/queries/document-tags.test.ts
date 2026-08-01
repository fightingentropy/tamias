import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import {
  createDatabase,
  type CloudflareD1DatabaseBinding,
  type CloudflareD1PreparedStatementBinding,
} from "../client";
import { deleteDocumentTag, getDocumentTags, upsertDocumentTags } from "./document-tags";
import {
  getDocumentTagAssignmentsForDocumentIds,
  getTaggedDocumentIdPage,
} from "./document-tag-assignments";

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
    resolve(import.meta.dir, "../../../../api/migrations/d1/0040_document_tags.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    sqlite,
    db: createDatabase({ cloudflare: { d1 } }),
    close: () => sqlite.close(),
  };
}

describe("document tags D1", () => {
  test("upserts, lists, and deletes document tags with assignments", async () => {
    const { db, sqlite, close } = createD1();

    try {
      const [invoice] = await upsertDocumentTags(db, [
        {
          teamId: "team-1",
          name: "Invoice",
          slug: "invoice",
        },
      ]);

      expect(invoice).toBeDefined();
      const invoiceId = invoice!.id;

      expect(invoice).toEqual({
        id: expect.any(String),
        slug: "invoice",
      });

      await upsertDocumentTags(db, [
        {
          teamId: "team-1",
          name: "Invoice Updated",
          slug: "invoice",
        },
        {
          teamId: "team-1",
          name: "Receipt",
          slug: "receipt",
        },
      ]);

      await expect(getDocumentTags(db, "team-1")).resolves.toEqual([
        { id: expect.any(String), name: "Invoice Updated" },
        { id: expect.any(String), name: "Receipt" },
      ]);

      sqlite
        .prepare(
          `insert into document_tag_assignments (
             team_id,
             document_id,
             tag_id,
             document_created_at,
             document_date,
             created_at,
             updated_at
           ) values (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run("team-1", "doc-1", invoiceId, "2026-05-01T00:00:00.000Z", "2026-05-01", "a", "a");

      await expect(
        getDocumentTagAssignmentsForDocumentIds(db, {
          teamId: "team-1",
          documentIds: ["doc-1"],
        }),
      ).resolves.toEqual([
        expect.objectContaining({
          documentId: "doc-1",
          tagId: invoiceId,
          documentTag: {
            id: invoiceId,
            name: "Invoice Updated",
            slug: "invoice",
          },
        }),
      ]);

      await expect(
        deleteDocumentTag(db, {
          teamId: "team-1",
          id: invoiceId,
        }),
      ).resolves.toEqual({ id: invoiceId });

      await expect(
        getDocumentTagAssignmentsForDocumentIds(db, {
          teamId: "team-1",
          documentIds: ["doc-1"],
        }),
      ).resolves.toEqual([]);
    } finally {
      close();
    }
  });

  test("pages tagged document ids by document creation time", async () => {
    const { db, sqlite, close } = createD1();

    try {
      const [tag] = await upsertDocumentTags(db, [
        {
          teamId: "team-1",
          name: "Receipt",
          slug: "receipt",
        },
      ]);
      expect(tag).toBeDefined();
      const tagId = tag!.id;

      const insert = sqlite.prepare(
        `insert into document_tag_assignments (
           team_id,
           document_id,
           tag_id,
           document_created_at,
           document_date,
           created_at,
           updated_at
         ) values (?, ?, ?, ?, ?, ?, ?)`,
      );

      insert.run("team-1", "doc-1", tagId, "2026-05-01T00:00:00.000Z", "2026-05-01", "a", "a");
      insert.run("team-1", "doc-2", tagId, "2026-05-02T00:00:00.000Z", "2026-05-02", "b", "b");
      insert.run("team-1", "doc-3", tagId, "2026-05-03T00:00:00.000Z", "2026-05-03", "c", "c");

      const firstPage = await getTaggedDocumentIdPage(db, {
        teamId: "team-1",
        tagIds: [tagId],
        pageSize: 2,
        order: "desc",
      });

      expect(firstPage.documentIds).toEqual(["doc-3", "doc-2"]);
      expect(firstPage.isDone).toBe(false);
      expect(firstPage.continueCursor).toEqual(expect.any(String));

      await expect(
        getTaggedDocumentIdPage(db, {
          teamId: "team-1",
          tagIds: [tagId],
          pageSize: 2,
          order: "desc",
          cursor: firstPage.continueCursor,
        }),
      ).resolves.toMatchObject({
        documentIds: ["doc-1"],
        isDone: true,
        continueCursor: null,
      });
    } finally {
      close();
    }
  });
});
