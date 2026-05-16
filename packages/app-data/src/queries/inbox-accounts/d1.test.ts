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
  deleteInboxAccount,
  getInboxAccountById,
  getInboxAccountInfo,
  getInboxAccounts,
  getInboxAccountsByIds,
  updateInboxAccount,
  upsertInboxAccount,
} from "../inbox-accounts";

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
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0007_inbox_accounts.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    d1,
    close: () => sqlite.close(),
  };
}

describe("inbox accounts D1", () => {
  test("upserts, lists, updates, reads, and deletes accounts in D1", async () => {
    const { d1, close } = createD1();
    const db = createDatabase({
      cloudflare: { d1 },
    });

    try {
      const created = await upsertInboxAccount(
        {
          teamId: "team-1",
          provider: "gmail",
          accessToken: "access-1",
          refreshToken: "refresh-1",
          email: "ops@example.com",
          lastAccessed: "2026-05-15T10:00:00.000Z",
          externalId: "gmail-user-1",
          expiryDate: "2026-05-16T10:00:00.000Z",
        },
        db,
      );

      expect(created).toMatchObject({
        provider: "gmail",
        external_id: "gmail-user-1",
      });

      await expect(getInboxAccounts("team-1", db)).resolves.toEqual([
        expect.objectContaining({
          id: created.id,
          email: "ops@example.com",
          status: "connected",
        }),
      ]);
      await expect(getInboxAccountsByIds([created.id, "missing"], db)).resolves.toEqual([
        expect.objectContaining({ id: created.id }),
      ]);
      await expect(
        getInboxAccountById({ id: created.id, teamId: "team-1" }, db),
      ).resolves.toMatchObject({
        id: created.id,
        accessToken: "access-1",
        refreshToken: "refresh-1",
      });
      await expect(getInboxAccountInfo({ id: created.id }, db)).resolves.toMatchObject({
        id: created.id,
        teamId: "team-1",
      });

      await expect(
        updateInboxAccount(
          {
            id: created.id,
            accessToken: "access-2",
            refreshToken: "refresh-2",
            expiryDate: "2026-05-17T10:00:00.000Z",
            scheduleId: "schedule-1",
            status: "disconnected",
            errorMessage: "token expired",
          },
          db,
        ),
      ).resolves.toEqual({ id: created.id });

      await expect(getInboxAccounts("team-1", db)).resolves.toEqual([
        expect.objectContaining({
          id: created.id,
          status: "disconnected",
          errorMessage: "token expired",
        }),
      ]);

      const updated = await upsertInboxAccount(
        {
          teamId: "team-1",
          provider: "gmail",
          accessToken: "access-3",
          refreshToken: "refresh-3",
          email: "ops+updated@example.com",
          lastAccessed: "2026-05-15T11:00:00.000Z",
          externalId: "gmail-user-1",
          expiryDate: "2026-05-18T10:00:00.000Z",
        },
        db,
      );

      expect(updated.id).toBe(created.id);
      await expect(getInboxAccounts("team-1", db)).resolves.toEqual([
        expect.objectContaining({
          id: created.id,
          email: "ops+updated@example.com",
          status: "connected",
          errorMessage: null,
        }),
      ]);

      await expect(deleteInboxAccount({ id: created.id, teamId: "team-1" }, db)).resolves.toEqual({
        id: created.id,
        scheduleId: "schedule-1",
      });
      await expect(getInboxAccounts("team-1", db)).resolves.toEqual([]);
      await expect(getInboxAccountInfo({ id: created.id }, db)).resolves.toBeNull();
    } finally {
      close();
    }
  });
});
