import { Database as SQLite, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  configureDatabaseRuntime,
  createDatabase,
  type CloudflareD1DatabaseBinding,
  type CloudflareD1PreparedStatementBinding,
} from "@tamias/app-data/client";
import { createAccessToken } from "@tamias/auth-session";
import { resolveTamiasUserSession } from "./auth";
import {
  completePasswordReset,
  getActiveAuthIdentity,
  handleDashboardAuthAction,
  requestPasswordReset,
} from "./first-party-auth";

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

function setup() {
  const sqlite = new SQLite(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const name of ["0020_identity_core.sql", "0053_password_recovery.sql"]) {
    sqlite.exec(
      readFileSync(resolve(import.meta.dir, `../../../api/migrations/d1/${name}`), "utf8"),
    );
  }
  const d1: CloudflareD1DatabaseBinding = {
    prepare: (sql) => new Statement(sqlite, sql),
    async batch<T>(statements: CloudflareD1PreparedStatementBinding[]) {
      return sqlite.transaction(() => statements.map((s) => (s as Statement).execute<T>()))();
    },
    async exec(query) {
      sqlite.exec(query);
      return { count: 0, duration: 0 };
    },
  };
  return { sqlite, d1, db: createDatabase({ cloudflare: { d1 } }) };
}

describe("password recovery", () => {
  let fixture: ReturnType<typeof setup>;
  const previousSecret = process.env.TAMIAS_AUTH_SECRET;
  const email = "recovery@example.test";
  const oldPassword = "old-password-for-tests";
  const newPassword = "new-password-for-tests";
  const signIn = (password = oldPassword, accountEmail = email, flow = "signIn") =>
    handleDashboardAuthAction(
      { action: "auth:signIn", args: { params: { email: accountEmail, password, flow } } },
      { db: fixture.db },
    );
  async function resetToken(accountEmail = email) {
    let token = "";
    await requestPasswordReset(
      accountEmail,
      async (_, value) => {
        token = value;
      },
      fixture.db,
    );
    return token;
  }

  beforeEach(() => {
    process.env.TAMIAS_AUTH_SECRET = "test-only-auth-secret-for-password-recovery";
    fixture = setup();
    configureDatabaseRuntime({ cloudflare: { d1: fixture.d1 } });
  });
  afterEach(() => {
    configureDatabaseRuntime(null);
    fixture.sqlite.close();
    if (previousSecret === undefined) delete process.env.TAMIAS_AUTH_SECRET;
    else process.env.TAMIAS_AUTH_SECRET = previousSecret;
  });

  test("changes only the intended account, rejects the old password and revokes access and refresh tokens", async () => {
    const original = await signIn(oldPassword, email, "signUp");
    const other = await signIn(oldPassword, "other@example.test", "signUp");
    const accessToken = original!.tokens!.token;
    expect(await resolveTamiasUserSession(accessToken)).not.toBeNull();
    const token = await resetToken();
    expect(token).toMatch(/^tamias_pr_[A-Za-z0-9_-]{43}$/);
    const stored = fixture.sqlite.query("select token_hash from auth_password_resets").get() as {
      token_hash: string;
    };
    expect(stored.token_hash).not.toBe(token);
    await completePasswordReset(token, newPassword, fixture.db);
    expect(await getActiveAuthIdentity(accessToken, fixture.db)).toBeNull();
    expect(await resolveTamiasUserSession(accessToken)).toBeNull();
    expect(await getActiveAuthIdentity(other!.tokens!.token, fixture.db)).not.toBeNull();
    expect(
      await handleDashboardAuthAction(
        { action: "auth:signIn", args: { refreshToken: original!.tokens!.refreshToken } },
        { db: fixture.db },
      ),
    ).toEqual({ tokens: null });
    await expect(signIn()).rejects.toThrow("InvalidSecret");
    const replacement = await signIn(newPassword);
    expect(await resolveTamiasUserSession(replacement!.tokens!.token)).not.toBeNull();
    await expect(completePasswordReset(token, "another-password", fixture.db)).rejects.toThrow(
      "expired or already been used",
    );
  });

  test("unknown accounts and cooldown return no account information or extra mail", async () => {
    await signIn(oldPassword, email, "signUp");
    let deliveries = 0;
    const deliver = async () => {
      deliveries++;
    };
    expect(await requestPasswordReset("missing@example.test", deliver, fixture.db)).toBeUndefined();
    expect(await requestPasswordReset(email.toUpperCase(), deliver, fixture.db)).toBeUndefined();
    expect(await requestPasswordReset(email, deliver, fixture.db)).toBeUndefined();
    expect(deliveries).toBe(1);
    expect((await signIn())!.tokens).toBeDefined();
  });

  test("failed delivery permits a retry and never changes credentials", async () => {
    await signIn(oldPassword, email, "signUp");
    await expect(
      requestPasswordReset(
        email,
        async () => {
          throw new Error("mail unavailable");
        },
        fixture.db,
      ),
    ).rejects.toThrow("delivery failed");
    expect(await resetToken()).not.toBe("");
    expect((await signIn())!.tokens).toBeDefined();
  });

  test("rejects expired, malformed, and unknown links without changing the password", async () => {
    await signIn(oldPassword, email, "signUp");
    const token = await resetToken();
    fixture.sqlite.exec("update auth_password_resets set expires_at = '2000-01-01T00:00:00.000Z'");
    for (const value of [token, "invalid", `tamias_pr_${"a".repeat(43)}`]) {
      await expect(completePasswordReset(value, newPassword, fixture.db)).rejects.toThrow(
        "expired or already been used",
      );
    }
    expect((await signIn())!.tokens).toBeDefined();
  });

  test("concurrent completion has exactly one winner and invalidates every outstanding link", async () => {
    await signIn(oldPassword, email, "signUp");
    const first = await resetToken();
    fixture.sqlite.exec("update auth_password_resets set created_at = '2000-01-01T00:00:00.000Z'");
    const second = await resetToken();
    const candidates = [newPassword, "a-different-password"];
    const results = await Promise.allSettled(
      candidates.map((password) => completePasswordReset(first, password, fixture.db)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const winner = results.findIndex((r) => r.status === "fulfilled");
    expect((await signIn(candidates[winner]))!.tokens).toBeDefined();
    await expect(signIn(candidates[1 - winner])).rejects.toThrow("InvalidSecret");
    await expect(completePasswordReset(second, oldPassword, fixture.db)).rejects.toThrow(
      "expired or already been used",
    );
  });

  test("a failed transaction leaves the link, password, and sessions intact", async () => {
    const original = await signIn(oldPassword, email, "signUp");
    const token = await resetToken();
    fixture.sqlite.exec(
      "create trigger fail_reset before update of secret_hash on auth_accounts begin select raise(abort, 'database failure'); end",
    );
    await expect(completePasswordReset(token, newPassword, fixture.db)).rejects.toThrow(
      "database failure",
    );
    expect(await getActiveAuthIdentity(original!.tokens!.token, fixture.db)).not.toBeNull();
    fixture.sqlite.exec("drop trigger fail_reset");
    await completePasswordReset(token, newPassword, fixture.db);
    expect((await signIn(newPassword))!.tokens).toBeDefined();
  });

  test("rejects a valid JWT with a missing, expired, or mismatched session", async () => {
    const original = await signIn(oldPassword, email, "signUp");
    const identity = await getActiveAuthIdentity(original!.tokens!.token, fixture.db);
    const mismatched = await createAccessToken(
      { id: "different-user", email },
      { sessionId: identity!.session_id! },
    );
    expect(await resolveTamiasUserSession(mismatched)).toBeNull();
    fixture.sqlite.exec("update auth_sessions set expires_at = '2000-01-01T00:00:00.000Z'");
    expect(await resolveTamiasUserSession(original!.tokens!.token)).toBeNull();
    fixture.sqlite.exec("delete from auth_sessions");
    expect(await resolveTamiasUserSession(original!.tokens!.token)).toBeNull();
  });
});
