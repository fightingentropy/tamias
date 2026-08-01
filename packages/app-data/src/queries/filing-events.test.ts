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
  allocateFilingSequence,
  createSubmissionEvent,
  listSubmissionEvents,
} from "./filing-events";

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
    resolve(import.meta.dir, "../../../../api/migrations/d1/0027_filing_events.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    db: createDatabase({ cloudflare: { d1 } }),
    close: () => sqlite.close(),
  };
}

describe("filing events D1", () => {
  test("allocates filing sequences per scope", async () => {
    const { db, close } = createD1();

    try {
      await expect(allocateFilingSequence(db, { scope: "accounts-sandbox" })).resolves.toBe(1);
      await expect(allocateFilingSequence(db, { scope: "accounts-sandbox" })).resolves.toBe(2);
      await expect(allocateFilingSequence(db, { scope: "ct-sandbox" })).resolves.toBe(1);
    } finally {
      close();
    }
  });

  test("creates and lists submission events with filters", async () => {
    const { db, close } = createD1();

    try {
      const first = await createSubmissionEvent(db, {
        teamId: "team_1",
        filingProfileId: "filing_profile_1",
        provider: "companies-house",
        obligationType: "accounts",
        vatReturnId: null,
        status: "pending",
        eventType: "request",
        correlationId: "corr_1",
        requestPayload: { companyNumber: "12345678" },
      });

      await new Promise((resolve) => setTimeout(resolve, 5));

      const second = await createSubmissionEvent(db, {
        teamId: "team_1",
        filingProfileId: "filing_profile_1",
        provider: "hmrc",
        obligationType: "vat",
        vatReturnId: "vat_return_1",
        status: "accepted",
        eventType: "response",
        correlationId: "corr_2",
        responsePayload: { receipt: "ok" },
      });

      await createSubmissionEvent(db, {
        teamId: "team_2",
        filingProfileId: "filing_profile_2",
        provider: "hmrc",
        obligationType: "vat",
        vatReturnId: "vat_return_2",
        status: "accepted",
        eventType: "response",
      });

      const teamEvents = await listSubmissionEvents(db, { teamId: "team_1" });
      expect(teamEvents.map((event) => event.id)).toEqual([second.id, first.id]);
      expect(teamEvents[0]).toMatchObject({
        teamId: "team_1",
        provider: "hmrc",
        obligationType: "vat",
        vatReturnId: "vat_return_1",
        responsePayload: { receipt: "ok" },
      });
      expect(teamEvents[1]).toMatchObject({
        teamId: "team_1",
        provider: "companies-house",
        obligationType: "accounts",
        requestPayload: { companyNumber: "12345678" },
      });

      const hmrcVatEvents = await listSubmissionEvents(db, {
        teamId: "team_1",
        provider: "hmrc",
        obligationType: "vat",
      });
      expect(hmrcVatEvents).toHaveLength(1);
      expect(hmrcVatEvents[0]?.id).toBe(second.id);
    } finally {
      close();
    }
  });
});
