import { Database as SQLite, type SQLQueryBindings } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CloudflareD1DatabaseBinding, CloudflareD1PreparedStatementBinding } from "../client";
import { createTeamInD1, getTeamByIdFromD1, updateTeamInD1 } from "./identity/d1";

class Statement implements CloudflareD1PreparedStatementBinding {
  constructor(
    readonly sqlite: SQLite,
    readonly sql: string,
    readonly values: SQLQueryBindings[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new Statement(this.sqlite, this.sql, values as SQLQueryBindings[]);
  }
  async first<T>(column?: string) {
    const row = this.sqlite.query(this.sql).get(...this.values) as Record<string, unknown> | null;
    return (column ? (row?.[column] ?? null) : row) as T | null;
  }
  async all<T>() {
    return { success: true, results: this.sqlite.query(this.sql).all(...this.values) as T[] };
  }
  async run<T>() {
    this.sqlite.query(this.sql).run(...this.values);
    return { success: true, results: [] as T[] };
  }
  async raw<T>() {
    return this.sqlite.query(this.sql).values(...this.values) as T[];
  }
}

function setup() {
  const sqlite = new SQLite(":memory:");
  for (const name of ["0020_identity_core.sql", "0051_business_profile.sql"]) {
    sqlite.exec(
      readFileSync(resolve(import.meta.dir, `../../../../api/migrations/d1/${name}`), "utf8"),
    );
  }
  const d1: CloudflareD1DatabaseBinding = {
    prepare: (sql) => new Statement(sqlite, sql),
    async batch<T>(statements: CloudflareD1PreparedStatementBinding[]) {
      return Promise.all(statements.map((s) => s.all<T>()));
    },
    async exec(query) {
      sqlite.exec(query);
      return { count: 0, duration: 0 };
    },
  };
  return { sqlite, d1 };
}

describe("business profile persistence", () => {
  test("saves independent structure and CIS values and keeps updates workspace-scoped", async () => {
    const { sqlite, d1 } = setup();
    try {
      await createTeamInD1(d1, {
        teamId: "a",
        name: "A",
        companyType: "tradesperson",
        businessStructure: "sole_trader",
        usesCis: true,
      });
      await createTeamInD1(d1, { teamId: "b", name: "B", companyType: "limited_company" });
      expect(await getTeamByIdFromD1(d1, "a")).toMatchObject({
        businessStructure: "sole_trader",
        usesCis: true,
      });
      await updateTeamInD1(d1, {
        teamId: "a",
        businessStructure: "limited_company",
        usesCis: false,
      });
      expect(await getTeamByIdFromD1(d1, "a")).toMatchObject({
        businessStructure: "limited_company",
        usesCis: false,
      });
      expect(await getTeamByIdFromD1(d1, "b")).toMatchObject({
        businessStructure: null,
        usesCis: null,
      });
      await updateTeamInD1(d1, { teamId: "a", name: "Updated" });
      expect(await getTeamByIdFromD1(d1, "a")).toMatchObject({
        businessStructure: "limited_company",
        usesCis: false,
      });
      await updateTeamInD1(d1, { teamId: "a", businessStructure: null, usesCis: null });
      expect(await getTeamByIdFromD1(d1, "a")).toMatchObject({
        businessStructure: null,
        usesCis: null,
      });
    } finally {
      sqlite.close();
    }
  });
  test("legacy clients can create a workspace without the new optional fields", async () => {
    const { sqlite, d1 } = setup();
    try {
      const team = await createTeamInD1(d1, { name: "Legacy", companyType: "cis_subcontractor" });
      expect(team).toMatchObject({
        companyType: "cis_subcontractor",
        businessStructure: null,
        usesCis: null,
      });
      expect(() => sqlite.exec("UPDATE teams SET uses_cis = 3")).toThrow();
      expect(() => sqlite.exec("UPDATE teams SET business_structure = 'invalid'")).toThrow();
    } finally {
      sqlite.close();
    }
  });
});
