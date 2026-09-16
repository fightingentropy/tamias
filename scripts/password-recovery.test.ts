import { Database as SQLite, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, beforeEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  configureDatabaseRuntime,
  type CloudflareD1DatabaseBinding,
  type CloudflareD1PreparedStatementBinding,
} from "@tamias/app-data/client";
import { configureEmailRuntime } from "@tamias/email/send";
import { authRouter } from "../api/src/rest/routers/auth";
import { consumeRateLimit } from "../api/src/rate-limit/shared";
import type { Context } from "../api/src/rest/types";

// These HTTP tests run outside the API suite, which globally mocks auth and D1.
class Statement implements CloudflareD1PreparedStatementBinding {
  constructor(
    readonly sqlite: SQLite,
    readonly sql: string,
    readonly values: SQLQueryBindings[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new Statement(this.sqlite, this.sql, values as SQLQueryBindings[]);
  }
  execute<T>() {
    return { success: true, results: this.sqlite.query(this.sql).all(...this.values) as T[] };
  }
  async first<T>(column?: string) {
    const row = this.sqlite.query(this.sql).get(...this.values) as Record<string, unknown> | null;
    return (column ? (row?.[column] ?? null) : row) as T | null;
  }
  async all<T>() {
    return this.execute<T>();
  }
  async run<T>() {
    return this.execute<T>();
  }
  async raw<T>() {
    return this.sqlite.query(this.sql).values(...this.values) as T[];
  }
}

let sqlite: SQLite;
let env: Context["Bindings"];
let background: Promise<unknown>[];
let mail: { to: string | string[]; text?: string }[];
const previousAppUrl = process.env.DASHBOARD_URL;

beforeEach(() => {
  sqlite = new SQLite(":memory:");
  for (const migration of ["0020_identity_core.sql", "0053_password_recovery.sql"]) {
    sqlite.exec(
      readFileSync(new URL(`../api/migrations/d1/${migration}`, import.meta.url), "utf8"),
    );
  }
  sqlite.exec(
    "insert into auth_accounts (id, user_id, provider, provider_account_id, secret_hash, created_at, updated_at) values ('account', 'user', 'password', 'owner@example.test', 'old-hash', '2026-01-01', '2026-01-01')",
  );
  const d1: CloudflareD1DatabaseBinding = {
    prepare: (sql) => new Statement(sqlite, sql),
    async batch<T>(statements: CloudflareD1PreparedStatementBinding[]) {
      return sqlite.transaction(() => statements.map((s) => (s as Statement).execute<T>()))();
    },
    async exec(sql) {
      sqlite.exec(sql);
      return { count: 0, duration: 0 };
    },
  };
  configureDatabaseRuntime({ cloudflare: { d1 } });
  background = [];
  mail = [];
  configureEmailRuntime({
    async send(message) {
      mail.push(message);
      return { messageId: "test" };
    },
  });
  process.env.DASHBOARD_URL = "https://app.example.test";
  const buckets = new Map<string, ReturnType<typeof consumeRateLimit>["bucket"]>();
  env = {
    RATE_LIMIT_COORDINATOR: {
      getByName(name: string) {
        return {
          async consume(payload: { key: string; limit: number; windowMs: number }) {
            const result = consumeRateLimit(buckets.get(name), payload);
            buckets.set(name, result.bucket);
            return result.outcome;
          },
        };
      },
    },
  } as unknown as Context["Bindings"];
});

afterEach(async () => {
  await Promise.all(background);
  configureEmailRuntime(null);
  configureDatabaseRuntime(null);
  sqlite.close();
  if (previousAppUrl === undefined) delete process.env.DASHBOARD_URL;
  else process.env.DASHBOARD_URL = previousAppUrl;
});

function post(path: string, body: unknown, ip = "192.0.2.1") {
  return authRouter.fetch(
    new Request(`https://untrusted.example${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": ip },
      body: JSON.stringify(body),
    }),
    env,
    {
      waitUntil(promise: Promise<unknown>) {
        background.push(promise);
      },
    } as never,
  );
}

test("reset HTTP response is identical for existing and unknown accounts; mail uses the configured app origin", async () => {
  const existing = await post("/password-reset/request", { email: "owner@example.test" });
  const missing = await post("/password-reset/request", { email: "unknown@example.test" });
  expect(existing.status).toBe(200);
  expect(existing.headers.get("cache-control")).toBe("no-store");
  expect(await existing.text()).toBe(await missing.text());
  await Promise.all(background);
  expect(mail).toHaveLength(1);
  expect(mail[0]?.to).toBe("owner@example.test");
  const link = mail[0]!.text!.match(/https:\/\/\S+/)![0]!;
  const url = new URL(link);
  expect(url.origin).toBe("https://app.example.test");
  expect(url.pathname).toBe("/reset-password");
  expect(url.search).toBe("");
  const token = new URLSearchParams(url.hash.slice(1)).get("token");
  expect(token).toMatch(/^tamias_pr_[A-Za-z0-9_-]{43}$/);
  const complete = await post("/password-reset/complete", {
    token,
    password: "new-password-for-http-test",
  });
  expect(complete.status).toBe(200);
  expect(complete.headers.has("set-cookie")).toBe(false);
  const replay = await post("/password-reset/complete", {
    token,
    password: "new-password-for-http-test",
  });
  expect(replay.status).toBe(400);
  await Promise.all(background);
  expect(mail).toHaveLength(2);
  expect(mail[1]!.text).not.toContain("new-password-for-http-test");
});

test("password recovery limits attempts per IP and rejects oversized and malformed requests", async () => {
  expect((await post("/password-reset/request", { email: "invalid" })).status).toBe(400);
  expect((await post("/password-reset/request", { email: "x".repeat(5000) })).status).toBe(413);
  for (let i = 0; i < 9; i++) {
    expect((await post("/password-reset/request", { email: "unknown@example.test" })).status).toBe(
      200,
    );
  }
  expect((await post("/password-reset/request", { email: "unknown@example.test" })).status).toBe(
    429,
  );
  expect(
    (await post("/password-reset/request", { email: "unknown@example.test" }, "192.0.2.2")).status,
  ).toBe(200);
  expect(
    (
      await post(
        "/password-reset/complete",
        { token: "invalid", password: "long-enough-password" },
        "192.0.2.2",
      )
    ).status,
  ).toBe(400);
});
