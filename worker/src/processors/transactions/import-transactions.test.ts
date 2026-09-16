import { Database as SQLite, type SQLQueryBindings } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createAsyncRun, getAsyncRun } from "@tamias/app-data/queries";
import type {
  CloudflareD1DatabaseBinding,
  CloudflareD1PreparedStatementBinding,
} from "@tamias/app-data/client";
import type { CloudflareAsyncMessage } from "../../cloudflare/async-helpers";
import { handleLedgerQueueBatch } from "../../cloudflare/ledger";
import type { CloudflareAsyncEnv } from "../../cloudflare/shared";
import { configureWorkerRuntime } from "../../cloudflare/worker-runtime";
import type { ImportTransactionsPayload } from "../../schemas/transactions";
import { IMPORT_BATCH_SIZE, prepareTransactionImportBatch } from "./import-transactions";

const payload: ImportTransactionsPayload = {
  teamId: "team-a",
  bankAccountId: "bank-a",
  currency: "GBP",
  inverted: false,
  filePath: ["team-a", "imports", "statement.csv"],
  mappings: { date: "date", description: "description", amount: "amount" },
};
const csv = (count: number) =>
  "date,description,amount\n" +
  Array.from(
    { length: count },
    (_, i) => `2026-09-01,${i === 50 ? "Payment 49" : `Payment ${i}`},-10`,
  ).join("\n");

describe("bounded transaction imports", () => {
  test("preserves identical payments across batch boundaries and stable IDs on retry", () => {
    const content = csv(110);
    const first = prepareTransactionImportBatch(content, payload);
    const nextPayload = {
      ...payload,
      cursor: { offset: 50, importedCount: 50, sourceHash: first.sourceHash },
    };
    const second = prepareTransactionImportBatch(content, nextPayload);
    expect(first.transactions).toHaveLength(IMPORT_BATCH_SIZE);
    expect(second.transactions[0]?.internal_id).not.toBe(first.transactions[49]?.internal_id);
    expect(prepareTransactionImportBatch(content, nextPayload)).toEqual(second);
    expect(
      prepareTransactionImportBatch(content, { ...payload, teamId: "team-b" }).transactions[0]
        ?.internal_id,
    ).not.toBe(first.transactions[0]?.internal_id);
    expect(() =>
      prepareTransactionImportBatch(content + "\n2026-09-02,New,-5", nextPayload),
    ).toThrow("file changed");
    expect(() => prepareTransactionImportBatch("date,amount\n2026-09-01,1,extra", payload)).toThrow(
      "Invalid CSV",
    );
  });

  test("imports a multi-year history across queue invocations and only completes at the end", async () => {
    const sqlite = new SQLite(":memory:");
    const migrations = resolve(import.meta.dir, "../../../../api/migrations/d1");
    for (const file of readdirSync(migrations)
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      sqlite.exec(readFileSync(resolve(migrations, file), "utf8"));
    }
    sqlite
      .query(
        "insert into teams (id,name,base_currency,created_at,updated_at) values ('team-a','Test','GBP','2026-01-01','2026-01-01')",
      )
      .run();
    let queries = 0;
    let failAt: number | null = null;
    const countQuery = () => {
      queries += 1;
      if (queries === failAt) {
        failAt = null;
        throw new Error("Temporary database failure");
      }
      if (queries > 1000) throw new Error("D1 query budget exceeded");
    };
    class Statement implements CloudflareD1PreparedStatementBinding {
      constructor(
        readonly sql: string,
        readonly values: SQLQueryBindings[] = [],
      ) {}
      bind(...values: unknown[]) {
        return new Statement(this.sql, values as SQLQueryBindings[]);
      }
      async first<T>(column?: string) {
        countQuery();
        const row = sqlite.query(this.sql).get(...this.values) as Record<string, unknown> | null;
        return (column ? (row?.[column] ?? null) : row) as T | null;
      }
      async all<T>() {
        countQuery();
        return { success: true, results: sqlite.query(this.sql).all(...this.values) as T[] };
      }
      async run<T>() {
        return this.all<T>();
      }
      async raw<T>() {
        countQuery();
        return sqlite.query(this.sql).values(...this.values) as T[];
      }
    }
    const d1: CloudflareD1DatabaseBinding = {
      prepare: (sql) => new Statement(sql),
      batch: async <T>(statements: CloudflareD1PreparedStatementBinding[]) =>
        Promise.all(statements.map((s) => s.all<T>())),
      exec: async (sql) => {
        sqlite.exec(sql);
        return { count: 0, duration: 0 };
      },
    };
    const pending: CloudflareAsyncMessage[] = [];
    const followups: CloudflareAsyncMessage[] = [];
    const content = csv(3353);
    const env = {
      APP_DB: d1,
      LEDGER_QUEUE: {
        send: async (body: CloudflareAsyncMessage) => {
          (body.jobName === "import-transactions" ? pending : followups).push(body);
        },
      },
      CAPTURE_QUEUE: {
        send: async (body: CloudflareAsyncMessage) => {
          followups.push(body);
        },
      },
      VAULT_BUCKET: {
        get: async () => ({
          size: content.length,
          arrayBuffer: async () => new TextEncoder().encode(content).buffer,
        }),
        put: async () => {},
        delete: async () => {},
      },
    } as unknown as CloudflareAsyncEnv;
    configureWorkerRuntime(env);
    const run = await createAsyncRun({
      publicTeamId: payload.teamId,
      provider: "cloudflare-queue",
      kind: "job",
      providerJobName: "import-transactions",
    });
    const initial: CloudflareAsyncMessage = {
      queue: "ledger",
      queueName: "transactions",
      jobName: "import-transactions",
      runId: run.id,
      payload,
    };
    pending.push(initial);
    let invocations = 0;
    let acknowledgements = 0;
    let retries = 0;
    const deliver = async (body: CloudflareAsyncMessage, shouldRetry = false) => {
      queries = 0;
      const previousRetries = retries;
      await handleLedgerQueueBatch(
        {
          messages: [
            {
              body,
              id: `message-${invocations++}`,
              attempts: 1,
              ack: () => {
                acknowledgements++;
              },
              retry: () => {
                retries++;
              },
            },
          ],
        } as unknown as MessageBatch<CloudflareAsyncMessage>,
        env,
      );
      expect(queries).toBeLessThan(1000);
      expect(retries - previousRetries).toBe(shouldRetry ? 1 : 0);
    };
    try {
      // Retry after part of a batch has already been written, without duplicates.
      failAt = 250;
      await deliver(pending.shift()!, true);
      expect((await getAsyncRun(run.id))?.status).toBe("waiting");
      pending.push(initial);
      while (pending.length) {
        expect(invocations).toBeLessThan(100);
        await deliver(pending.shift()!);
        const status = await getAsyncRun(run.id);
        expect(status?.status).toBe(pending.length ? "active" : "completed");
      }
      expect(invocations).toBe(Math.ceil(3353 / IMPORT_BATCH_SIZE) + 1);
      expect(acknowledgements).toBe(invocations - 1);
      expect((await getAsyncRun(run.id))?.result).toEqual({
        importedCount: 3353,
        skippedCount: 0,
        invalidCount: 0,
      });
      expect(
        sqlite
          .query(
            "select count(*) as n, sum(amount) as total from transactions where team_id = 'team-a'",
          )
          .get(),
      ).toEqual({ n: 3353, total: -33530 });
      expect(sqlite.query("select count(*) as n from compliance_journal_entries").get()).toEqual({
        n: 3353,
      });
      expect(followups).toHaveLength((invocations - 1) * 2);
      for (const followup of followups) {
        const data = followup.payload as {
          transactionIds?: string[];
          newTransactionIds?: string[];
        };
        expect((data.transactionIds ?? data.newTransactionIds)!.length).toBeLessThanOrEqual(
          IMPORT_BATCH_SIZE,
        );
      }
      // A late duplicate queue delivery cannot reopen a completed import.
      await deliver(initial);
      expect(pending).toHaveLength(0);
      expect((await getAsyncRun(run.id))?.status).toBe("completed");
      expect(sqlite.query("select count(*) as n from transactions").get()).toEqual({ n: 3353 });
    } finally {
      sqlite.close();
    }
  }, 30000);
});
