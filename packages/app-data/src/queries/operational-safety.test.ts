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
  beginIdempotentOperation,
  completeIdempotentOperation,
  failIdempotentOperation,
  recordDeadLetterMessage,
  requireIdempotentOperationReconciliation,
} from "./operational-safety";

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
    return (columnName ? (row?.[columnName] ?? null) : row) as T | null;
  }

  async all<T = unknown>() {
    return { results: (this.statement as any).all(...this.values) as T[], success: true };
  }

  async run<T = unknown>() {
    (this.statement as any).run(...this.values);
    return { results: [] as T[], success: true };
  }

  async raw<T = unknown[]>() {
    return (this.statement as any).values(...this.values) as T[];
  }
}

class SqliteD1Database implements CloudflareD1DatabaseBinding {
  constructor(private readonly sqlite: SqliteDatabase) {}

  prepare(query: string) {
    return new SqliteD1Statement(this.sqlite.prepare(query));
  }

  async batch<T = unknown>(statements: CloudflareD1PreparedStatementBinding[]) {
    const results: Array<{ results?: T[]; success?: boolean }> = [];
    this.sqlite.transaction(() => {
      for (const statement of statements) {
        results.push({ results: [], success: true });
        void statement.run<T>();
      }
    })();
    return results;
  }

  async exec(query: string) {
    this.sqlite.exec(query);
    return { count: 0, duration: 0 };
  }
}

function createD1() {
  const sqlite = new SqliteDatabase(":memory:");
  sqlite.exec("create table submission_events (id text primary key)");
  sqlite.exec(
    readFileSync(
      resolve(import.meta.dir, "../../../../api/migrations/d1/0049_operational_safety.sql"),
      "utf8",
    ),
  );
  const d1 = new SqliteD1Database(sqlite);
  return { sqlite, db: createDatabase({ cloudflare: { d1 } }) };
}

describe("operational mutation safety", () => {
  test("claims, completes, audits, enqueues, and replays an idempotent operation", async () => {
    const { sqlite, db } = createD1();
    try {
      const request = { amount: 1250, currency: "GBP" };
      const started = await beginIdempotentOperation(db, {
        teamId: "team-1",
        scope: "payment.intent",
        idempotencyKey: "payment-12345678",
        request,
      });
      expect(started).toMatchObject({ state: "started", attemptCount: 1 });
      if (started.state !== "started") throw new Error("Expected a new operation");

      await expect(
        beginIdempotentOperation(db, {
          teamId: "team-1",
          scope: "payment.intent",
          idempotencyKey: "payment-12345678",
          request,
        }),
      ).rejects.toThrow("already in progress");

      await completeIdempotentOperation(db, {
        teamId: "team-1",
        scope: "payment.intent",
        idempotencyKey: "payment-12345678",
        leaseToken: started.leaseToken,
        result: { paymentIntentId: "pi_123" },
        audit: {
          actorType: "user",
          actorId: "user-1",
          action: "payment.intent.created",
          resourceType: "invoice",
          resourceId: "invoice-1",
          confirmationId: "confirmation-1",
          environment: "sandbox",
        },
        outbox: {
          topic: "payment.intent.created",
          aggregateType: "invoice",
          aggregateId: "invoice-1",
          payload: { paymentIntentId: "pi_123" },
        },
      });

      await expect(
        beginIdempotentOperation(db, {
          teamId: "team-1",
          scope: "payment.intent",
          idempotencyKey: "payment-12345678",
          request,
        }),
      ).resolves.toMatchObject({ state: "replayed", result: { paymentIntentId: "pi_123" } });
      expect(
        sqlite.query("select count(*) as count from immutable_audit_events").get() as {
          count: number;
        },
      ).toEqual({ count: 1 });
      expect(
        sqlite.query("select count(*) as count from transactional_outbox").get() as {
          count: number;
        },
      ).toEqual({ count: 1 });
      expect(() => sqlite.exec("delete from immutable_audit_events")).toThrow("cannot be deleted");
    } finally {
      sqlite.close();
    }
  });

  test("rejects key reuse with different input and permits retry after failure", async () => {
    const { sqlite, db } = createD1();
    try {
      const base = {
        teamId: "team-1",
        scope: "filing.submit",
        idempotencyKey: "filing-12345678",
      };
      const started = await beginIdempotentOperation(db, {
        ...base,
        request: { period: "2026-Q1" },
      });
      if (started.state !== "started") throw new Error("Expected a new operation");
      await expect(
        beginIdempotentOperation(db, { ...base, request: { period: "2026-Q2" } }),
      ).rejects.toThrow("different request");
      await failIdempotentOperation(db, {
        ...base,
        leaseToken: started.leaseToken,
        error: new Error("provider unavailable"),
      });
      const retry = await beginIdempotentOperation(db, {
        ...base,
        request: { period: "2026-Q1" },
      });
      expect(retry).toMatchObject({ state: "started", attemptCount: 2 });
      if (retry.state !== "started") throw new Error("Expected a retried operation");

      await expect(
        failIdempotentOperation(db, {
          ...base,
          leaseToken: started.leaseToken,
          error: new Error("late failure from the stale attempt"),
        }),
      ).rejects.toThrow("lease was lost");
      expect(
        sqlite
          .query(
            `select status, attempt_count from operation_idempotency
             where team_id = ? and operation_scope = ? and idempotency_key = ?`,
          )
          .get(base.teamId, base.scope, base.idempotencyKey),
      ).toEqual({ status: "pending", attempt_count: 2 });

      await expect(
        completeIdempotentOperation(db, {
          ...base,
          leaseToken: started.leaseToken,
          result: { stale: true },
          audit: {
            actorType: "system",
            actorId: "stale-worker",
            action: "filing.submit.stale",
            resourceType: "filing",
            environment: "test",
          },
          outbox: {
            topic: "filing.submit.stale",
            aggregateType: "filing",
            aggregateId: "filing-1",
            payload: {},
          },
        }),
      ).rejects.toThrow("lease was lost");
      expect(sqlite.query("select count(*) as count from immutable_audit_events").get()).toEqual({
        count: 0,
      });
      expect(sqlite.query("select count(*) as count from transactional_outbox").get()).toEqual({
        count: 0,
      });
    } finally {
      sqlite.close();
    }
  });

  test("blocks retries after a provider side effect needs reconciliation", async () => {
    const { sqlite, db } = createD1();
    try {
      const operation = {
        teamId: "team-1",
        scope: "filing.submit",
        idempotencyKey: "filing-accepted-12345678",
      };
      const request = { period: "2026-Q1" };
      const started = await beginIdempotentOperation(db, { ...operation, request });
      if (started.state !== "started") throw new Error("Expected a new operation");
      await requireIdempotentOperationReconciliation(db, {
        ...operation,
        leaseToken: started.leaseToken,
        error: new Error("receipt persistence failed"),
        providerResult: { correlationId: "provider-123" },
      });

      await expect(beginIdempotentOperation(db, { ...operation, request })).rejects.toThrow(
        "requires manual reconciliation",
      );
      expect(
        sqlite
          .query(
            `select status, result_json from operation_idempotency
             where team_id = ? and operation_scope = ? and idempotency_key = ?`,
          )
          .get(operation.teamId, operation.scope, operation.idempotencyKey),
      ).toEqual({
        status: "reconciliation_required",
        result_json: JSON.stringify({ correlationId: "provider-123" }),
      });
    } finally {
      sqlite.close();
    }
  });

  test("persists dead-letter messages once and keeps them immutable", async () => {
    const { sqlite, db } = createD1();
    try {
      const message = {
        queueName: "tamias-ledger-dlq",
        messageId: "message-123",
        teamId: "team-1",
        body: { jobName: "post-journal" },
        failureReason: "delivery retries exhausted",
        deliveryAttempts: 4,
      };
      await recordDeadLetterMessage(db, message);
      await recordDeadLetterMessage(db, message);

      expect(
        sqlite
          .query(
            `select queue_name, message_id, team_id, body_json, failure_reason,
                    delivery_attempts
             from dead_letter_messages`,
          )
          .get(),
      ).toEqual({
        queue_name: message.queueName,
        message_id: message.messageId,
        team_id: message.teamId,
        body_json: JSON.stringify(message.body),
        failure_reason: message.failureReason,
        delivery_attempts: message.deliveryAttempts,
      });
      expect(() => sqlite.exec("delete from dead_letter_messages")).toThrow("cannot be deleted");
    } finally {
      sqlite.close();
    }
  });
});
