import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import type {
  CloudflareD1DatabaseBinding,
  CloudflareD1PreparedStatementBinding,
} from "../../client";
import {
  createBankAccountInD1,
  deleteBankAccountFromD1,
  getBankAccountByIdFromD1,
  getBankAccountsBalancesFromD1,
  getBankAccountsCurrenciesFromD1,
  getBankAccountsFromD1,
  getBankAccountTeamIdFromD1,
  patchBankAccountInD1,
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
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0004_bank_accounts.sql"),
    "utf8",
  );

  sqlite.exec(migration);

  return {
    d1,
    close: () => sqlite.close(),
  };
}

describe("bank accounts D1", () => {
  test("creates, reads, patches, and deletes bank accounts", async () => {
    const { d1, close } = createD1();

    try {
      const created = await createBankAccountInD1(d1, {
        teamId: "team-1",
        userId: "user-1",
        name: "Operating",
        currency: "USD",
        manual: true,
        accountId: "manual-operating",
      });

      expect(typeof created.id).toBe("string");
      expect(created.name).toBe("Operating");
      expect(created.enabled).toBe(true);
      expect(created.type).toBe("depository");

      const [listed] = await getBankAccountsFromD1(d1, {
        teamId: "team-1",
        enabled: true,
        manual: true,
      });

      expect(listed?.id).toBe(created.id);

      const patched = await patchBankAccountInD1(d1, {
        id: created.id,
        teamId: "team-1",
        name: "Operating Reserve",
        type: "other_asset",
        balance: 1250.75,
        baseBalance: 1250.75,
        baseCurrency: "USD",
        availableBalance: 1100,
      });

      expect(patched?.name).toBe("Operating Reserve");
      expect(patched?.balance).toBe(1250.75);
      expect(patched?.availableBalance).toBe(1100);

      const byId = await getBankAccountByIdFromD1(d1, {
        id: created.id,
        teamId: "team-1",
      });
      expect(byId?.name).toBe("Operating Reserve");

      const teamId = await getBankAccountTeamIdFromD1(d1, { id: created.id });
      expect(teamId).toBe("team-1");

      const balances = await getBankAccountsBalancesFromD1(d1, "team-1");
      expect(balances).toEqual([
        {
          id: created.id,
          currency: "USD",
          balance: 1250.75,
          name: "Operating Reserve",
          logo_url: "",
        },
      ]);

      const currencies = await getBankAccountsCurrenciesFromD1(d1, "team-1");
      expect(currencies).toEqual([{ currency: "USD" }]);

      await deleteBankAccountFromD1(d1, {
        id: created.id,
        teamId: "team-1",
      });

      const deleted = await getBankAccountByIdFromD1(d1, {
        id: created.id,
        teamId: "team-1",
      });
      expect(deleted).toBeNull();
    } finally {
      close();
    }
  });
});
