import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { configureDatabaseRuntime } from "../client";
import type { CloudflareD1DatabaseBinding, CloudflareD1PreparedStatementBinding } from "../client";
import {
  createAsyncRun,
  getAsyncRun,
  getAsyncRunByProviderRunId,
  updateAsyncRun,
} from "./async-runs";

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
    resolve(import.meta.dir, "../../../../api/migrations/d1/0001_async_runs.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    d1,
    close: () => sqlite.close(),
  };
}

describe("async runs D1", () => {
  afterEach(() => {
    configureDatabaseRuntime(null);
  });

  test("creates, reads, finds, and updates async runs in D1", async () => {
    const { d1, close } = createD1();
    configureDatabaseRuntime({
      cloudflare: { d1 },
    });

    try {
      const created = await createAsyncRun({
        publicRunId: "run-1",
        publicTeamId: "team-1",
        appUserId: "user-1",
        provider: "cloudflare-workflow",
        kind: "workflow",
        providerRunId: "workflow-1",
        providerJobName: "monthly-insight",
        status: "waiting",
        metadata: { source: "test" },
      });

      expect(created).toMatchObject({
        id: "run-1",
        teamId: "team-1",
        appUserId: "user-1",
        providerRunId: "workflow-1",
        status: "waiting",
        metadata: { source: "test" },
      });
      await expect(getAsyncRun("run-1")).resolves.toMatchObject({ id: "run-1" });
      await expect(
        getAsyncRunByProviderRunId("cloudflare-workflow", "workflow-1"),
      ).resolves.toMatchObject({ id: "run-1" });

      await expect(
        updateAsyncRun({
          runId: "run-1",
          status: "completed",
          progress: 1,
          result: { ok: true },
          completedAt: "2026-05-15T12:00:00.000Z",
        }),
      ).resolves.toMatchObject({
        id: "run-1",
        status: "completed",
        progress: 1,
        result: { ok: true },
        completedAt: "2026-05-15T12:00:00.000Z",
      });
    } finally {
      close();
    }
  });
});
