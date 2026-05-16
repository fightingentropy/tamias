import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Database as SqliteDatabase } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import {
  createDatabase,
  type CloudflareD1DatabaseBinding,
  type CloudflareD1PreparedStatementBinding,
} from "../../client";
import {
  addProviderAccountsInD1,
  createBankConnectionInD1,
  deleteBankConnectionFromD1,
  getBankAccountDetailsFromD1,
  getBankAccountsWithPaymentInfoFromD1,
  getBankConnectionByIdFromD1,
  getBankConnectionByReferenceIdFromD1,
  getBankConnectionsFromD1,
  patchBankConnectionInD1,
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
  const bankAccountsMigration = readFileSync(
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0004_bank_accounts.sql"),
    "utf8",
  );
  const bankConnectionsMigration = readFileSync(
    resolve(import.meta.dir, "../../../../../api/migrations/d1/0005_bank_connections.sql"),
    "utf8",
  );

  sqlite.exec(bankAccountsMigration);
  sqlite.exec(bankConnectionsMigration);

  return {
    d1,
    db: createDatabase({
      cloudflare: { d1 },
    }),
    close: () => sqlite.close(),
  };
}

describe("bank connections D1", () => {
  test("manages connection, account, and payment-info reads", async () => {
    const { d1, db, close } = createD1();

    try {
      const connection = await createBankConnectionInD1(d1, {
        teamId: "team-1",
        userId: "user-1",
        provider: "truelayer",
        accessToken: "access-token",
        referenceId: "reference-1",
        accounts: [
          {
            accountId: "provider-account-1",
            institutionId: "institution-1",
            logoUrl: "https://bank.example/logo.png",
            name: "Operating",
            bankName: "Example Bank",
            currency: "GBP",
            enabled: true,
            balance: 500,
            type: "depository",
            iban: "GB00EXAMPLE",
            sortCode: "010203",
          },
        ],
      });

      expect(connection?.id).toBeTruthy();
      expect(connection?.bankAccounts).toHaveLength(1);

      const listed = await getBankConnectionsFromD1(d1, {
        teamId: "team-1",
        enabled: true,
      });
      expect(listed.map((item) => item.id)).toEqual([connection!.id]);
      expect(listed[0]?.bankAccounts[0]?.bankConnection?.accessToken).toBe("access-token");

      const byReference = await getBankConnectionByReferenceIdFromD1(d1, {
        referenceId: "reference-1",
      });
      expect(byReference?.id).toBe(connection?.id);

      const patched = await patchBankConnectionInD1(d1, {
        id: connection!.id,
        teamId: "team-1",
        status: "disconnected",
        lastAccessed: "2026-05-15T12:00:00.000Z",
      });
      expect(patched?.status).toBe("disconnected");

      const added = await addProviderAccountsInD1(d1, {
        connectionId: connection!.id,
        teamId: "team-1",
        userId: "user-1",
        accounts: [
          {
            accountId: "provider-account-2",
            name: "Savings",
            currency: "GBP",
            type: "other_asset",
            accountNumber: "12345678",
          },
        ],
      });
      expect(added).toHaveLength(1);

      const paymentInfo = await getBankAccountsWithPaymentInfoFromD1(d1, {
        teamId: "team-1",
      });
      expect(paymentInfo.map((account) => account.name)).toEqual(["Operating", "Savings"]);

      const details = await getBankAccountDetailsFromD1(d1, {
        accountId: added[0]!.id,
        teamId: "team-1",
      });
      expect(details?.accountNumber).toBe("12345678");

      await deleteBankConnectionFromD1(db, {
        id: connection!.id,
        teamId: "team-1",
      });

      const deleted = await getBankConnectionByIdFromD1(d1, {
        id: connection!.id,
      });
      expect(deleted).toBeNull();
    } finally {
      close();
    }
  });
});
