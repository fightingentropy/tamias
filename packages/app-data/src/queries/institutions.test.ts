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
  getActiveInstitutionIds,
  getInstitutionById,
  getInstitutions,
  markInstitutionsRemoved,
  upsertInstitutions,
  updateInstitutionUsage,
} from "./institutions";

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
    resolve(import.meta.dir, "../../../../api/migrations/d1/0024_institutions.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    db: createDatabase({ cloudflare: { d1 } }),
    close: () => sqlite.close(),
  };
}

describe("institutions D1", () => {
  test("upserts, searches, updates usage, and marks removed institutions", async () => {
    const { db, close } = createD1();

    try {
      await expect(
        upsertInstitutions(db, [
          {
            id: "ins_alpha",
            name: "Alpha Business Bank",
            logo: "https://cdn.example/alpha.png",
            provider: "truelayer",
            countries: ["GB"],
            availableHistory: null,
            maximumConsentValidity: 90,
            popularity: 5,
            type: "business",
          },
          {
            id: "ins_beta",
            name: "Beta Bank",
            logo: null,
            provider: "truelayer",
            countries: ["GB", "IE"],
            availableHistory: 365,
            maximumConsentValidity: 90,
            popularity: 20,
            type: "personal",
          },
          {
            id: "ins_us",
            name: "US Only Bank",
            logo: null,
            provider: "truelayer",
            countries: ["US"],
            availableHistory: null,
            maximumConsentValidity: null,
            popularity: 100,
            type: null,
          },
        ]),
      ).resolves.toBe(3);

      await upsertInstitutions(db, [
        {
          id: "ins_alpha",
          name: "Alpha Commercial Bank",
          logo: "https://cdn.example/alpha-new.png",
          provider: "truelayer",
          countries: ["GB"],
          availableHistory: 180,
          maximumConsentValidity: 90,
          popularity: 999,
          type: "business",
        },
      ]);

      const alpha = await getInstitutionById(db, { id: "ins_alpha" });
      expect(alpha).toMatchObject({
        id: "ins_alpha",
        name: "Alpha Commercial Bank",
        logo: "https://cdn.example/alpha-new.png",
        popularity: 5,
        availableHistory: 180,
        countries: ["GB"],
      });

      const listed = await getInstitutions(db, {
        countryCode: "GB",
        q: "bank",
        limit: 10,
      });
      expect(listed.map((institution) => institution.id)).toEqual(["ins_beta", "ins_alpha"]);

      await expect(updateInstitutionUsage(db, { id: "ins_alpha" })).resolves.toMatchObject({
        id: "ins_alpha",
        popularity: 6,
      });

      await expect(getActiveInstitutionIds(db, ["truelayer"])).resolves.toEqual([
        "ins_alpha",
        "ins_beta",
        "ins_us",
      ]);

      await expect(markInstitutionsRemoved(db, ["ins_beta", "missing"])).resolves.toBe(1);
      await expect(
        getInstitutions(db, {
          countryCode: "GB",
          limit: 10,
        }),
      ).resolves.toHaveLength(1);
    } finally {
      close();
    }
  });
});
