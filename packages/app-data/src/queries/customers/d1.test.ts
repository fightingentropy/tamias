import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import type {
  CloudflareD1DatabaseBinding,
  CloudflareD1PreparedStatementBinding,
} from "../../client";
import {
  clearCustomerEnrichmentFromD1,
  countCustomersCreatedBetweenFromD1,
  getCustomerByIdFromD1,
  getCustomerByPortalIdFromD1,
  getCustomerForEnrichmentFromD1,
  getCustomersPageFromD1,
  getCustomerTagsByCustomerIdFromD1,
  getCustomersFromD1,
  getCustomersNeedingEnrichmentFromD1,
  getRecentCustomerCountsFromD1,
  replaceCustomerTagsInD1,
  searchCustomersFromD1,
  toggleCustomerPortalInD1,
  updateCustomerEnrichmentInD1,
  updateCustomerEnrichmentStatusInD1,
  upsertCustomerInD1,
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
  const tagsMigration = readFileSync(
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0003_tags.sql"),
    "utf8",
  );
  const customersMigration = readFileSync(
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0031_customers.sql"),
    "utf8",
  );
  const customersSearchMigration = readFileSync(
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0048_customer_search_fts.sql"),
    "utf8",
  );

  sqlite.exec(tagsMigration);
  sqlite.exec(customersMigration);
  sqlite.exec(customersSearchMigration);

  return {
    d1,
    sqlite,
    close: () => sqlite.close(),
  };
}

describe("customers D1", () => {
  test("upserts, searches, tags, portal, enrichment, and counts customers", async () => {
    const { d1, sqlite, close } = createD1();

    try {
      sqlite
        .prepare(
          `insert into tags (id, team_id, name, created_at, updated_at)
           values (?, ?, ?, ?, ?)`,
        )
        .run("tag-vip", "team-1", "VIP", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");

      const created = await upsertCustomerInD1(d1, {
        id: "customer-1",
        teamId: "team-1",
        createdAt: "2026-01-02T00:00:00.000Z",
        name: "Acme Ltd",
        email: "Billing@Acme.example",
        website: "https://acme.example",
        city: "London",
        industry: "Manufacturing",
        enrichmentStatus: "pending",
      });

      expect(created).toMatchObject({
        id: "customer-1",
        email: "billing@acme.example",
        status: "active",
        source: "manual",
        portalEnabled: false,
      });

      await upsertCustomerInD1(d1, {
        id: "customer-2",
        teamId: "team-1",
        createdAt: "2026-01-03T00:00:00.000Z",
        name: "Beta Accounting",
        email: "hello@beta.example",
        industry: "Retail",
      });

      await replaceCustomerTagsInD1(d1, {
        teamId: "team-1",
        customerId: "customer-1",
        tagIds: ["tag-vip"],
      });

      const tags = await getCustomerTagsByCustomerIdFromD1(d1, {
        teamId: "team-1",
        customerIds: ["customer-1"],
      });
      expect(tags.get("customer-1")).toEqual([{ id: "tag-vip", name: "VIP" }]);

      await expect(
        getCustomerByIdFromD1(d1, { id: "customer-1", teamId: "team-1" }),
      ).resolves.toMatchObject({
        name: "Acme Ltd",
        city: "London",
      });

      await expect(
        searchCustomersFromD1(d1, { teamId: "team-1", query: "manufacturing" }),
      ).resolves.toMatchObject([{ id: "customer-1" }]);
      await expect(getCustomersFromD1(d1, { teamId: "team-1", q: "acme" })).resolves.toHaveLength(
        1,
      );
      await expect(
        getCustomersPageFromD1(d1, { teamId: "team-1", q: "acme", pageSize: 1 }),
      ).resolves.toMatchObject({
        page: [{ id: "customer-1" }],
        isDone: true,
      });

      const portal = await toggleCustomerPortalInD1(d1, {
        teamId: "team-1",
        customerId: "customer-1",
        enabled: true,
      });
      expect(portal.portalEnabled).toBe(true);
      expect(portal.portalId).toHaveLength(21);
      await expect(
        getCustomerByPortalIdFromD1(d1, { portalId: portal.portalId! }),
      ).resolves.toMatchObject({ id: "customer-1" });

      await expect(
        getCustomerForEnrichmentFromD1(d1, { teamId: "team-1", customerId: "customer-1" }),
      ).resolves.toMatchObject({
        id: "customer-1",
        website: "https://acme.example",
      });
      await expect(
        getCustomersNeedingEnrichmentFromD1(d1, { teamId: "team-1" }),
      ).resolves.toHaveLength(1);

      await updateCustomerEnrichmentStatusInD1(d1, {
        customerId: "customer-1",
        status: "processing",
      });
      await updateCustomerEnrichmentInD1(d1, {
        teamId: "team-1",
        customerId: "customer-1",
        data: {
          description: "Industrial equipment customer",
          financeContactEmail: "ap@acme.example",
        },
      });
      await expect(
        getCustomerByIdFromD1(d1, { id: "customer-1", teamId: "team-1" }),
      ).resolves.toMatchObject({
        enrichmentStatus: "completed",
        description: "Industrial equipment customer",
        financeContactEmail: "ap@acme.example",
      });

      await clearCustomerEnrichmentFromD1(d1, {
        teamId: "team-1",
        customerId: "customer-1",
      });
      await expect(
        getCustomerByIdFromD1(d1, { id: "customer-1", teamId: "team-1" }),
      ).resolves.toMatchObject({
        description: null,
        enrichmentStatus: null,
      });

      await expect(
        countCustomersCreatedBetweenFromD1(d1, {
          teamId: "team-1",
          from: "2026-01-01T00:00:00.000Z",
          to: "2026-01-31T23:59:59.999Z",
        }),
      ).resolves.toBe(2);
      await expect(
        getRecentCustomerCountsFromD1(d1, {
          teamId: "team-1",
          sinceIso: "2026-01-03T00:00:00.000Z",
          activeCustomerIds: new Set(),
        }),
      ).resolves.toEqual({
        newCustomersCount: 1,
        inactiveClientsCount: 1,
      });
    } finally {
      close();
    }
  });
});
