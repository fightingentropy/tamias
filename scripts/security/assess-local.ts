// Local HTTP assessment: real auth, routers and SQL with synthetic users only.
// No production URLs, saved login sessions or credentials are read.
import { Database as SQLite, type SQLQueryBindings } from "bun:sqlite";
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import {
  configureDatabaseRuntime,
  createDatabase,
  type CloudflareD1DatabaseBinding,
} from "@tamias/app-data/client";

process.env.LOG_LEVEL = "silent";
process.env.TAMIAS_AUTH_SECRET = crypto.randomUUID() + crypto.randomUUID();
process.env.TAMIAS_ENCRYPTION_KEY = "ab".repeat(32);
process.env.TAMIAS_DASHBOARD_SESSION_KEY = crypto.randomUUID();
process.env.HMRC_VAT_CLIENT_ID = "local-test-client";
process.env.HMRC_VAT_CLIENT_SECRET = "local-test-secret";
process.env.HMRC_VAT_ENVIRONMENT = "sandbox";
process.env.HMRC_VAT_OAUTH_REDIRECT_URL = "http://localhost/apps/hmrc-vat/oauth-callback";
process.env.API_URL = "http://localhost";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
// Only the Workers platform class is shimmed; no authentication or query mocks.
mock.module("cloudflare:workers", () => ({ DurableObject: class {} }));
const nativeFetch = globalThis.fetch;
globalThis.fetch = Object.assign(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname !== "127.0.0.1")
      throw new Error(`External network blocked during assessment: ${url.hostname}`);
    return nativeFetch(input, init);
  },
  { preconnect: nativeFetch.preconnect },
);

const sqlite = new SQLite(":memory:");
const migrationDir = path.resolve(import.meta.dir, "../../api/migrations/d1");
for (const filename of readdirSync(migrationDir)
  .filter((f) => f.endsWith(".sql"))
  .sort())
  sqlite.exec(readFileSync(path.join(migrationDir, filename), "utf8"));
sqlite.exec("PRAGMA foreign_keys = ON");
class Statement {
  constructor(
    readonly sql: string,
    readonly values: SQLQueryBindings[] = [],
  ) {}
  bind(...values: unknown[]) {
    return new Statement(this.sql, values as SQLQueryBindings[]);
  }
  execute<T>() {
    return { success: true, results: sqlite.query(this.sql).all(...this.values) as T[] };
  }
  async all<T>() {
    return this.execute<T>();
  }
  async run<T>() {
    return this.execute<T>();
  }
  async first<T>(column?: string) {
    const row = sqlite.query(this.sql).get(...this.values) as Record<string, unknown> | null;
    return (column ? (row?.[column] ?? null) : row) as T | null;
  }
  async raw<T>() {
    return sqlite.query(this.sql).values(...this.values) as T[];
  }
}
const d1: CloudflareD1DatabaseBinding = {
  prepare: (sql) => new Statement(sql),
  async batch<T>(statements) {
    return sqlite.transaction(() => statements.map((s) => (s as Statement).execute<T>()))();
  },
  async exec(query) {
    sqlite.exec(query);
    return { count: 0, duration: 0 };
  },
};
configureDatabaseRuntime({ cloudflare: { d1 } });
const db = createDatabase();
const { handleDashboardAuthAction } = await import("@tamias/app-services/first-party-auth");
const { createApiKeyInD1 } = await import("@tamias/app-services/foundation");
const { createApp, storeHmrcOAuthState, consumeHmrcOAuthState } =
  await import("@tamias/app-data/queries");
const { handleTrpcFastPath } = await import("../../api/src/index");
const { withAuth } = await import("../../api/src/rest/middleware/auth");
const { withRequiredScope } = await import("../../api/src/rest/middleware/scope");
const { installUrlRouter } = await import("../../api/src/rest/routers/apps/hmrc-vat/install-url");
const { oauthCallbackRouter } =
  await import("../../api/src/rest/routers/apps/hmrc-vat/oauth-callback");
const { encryptComplianceOAuthState, decryptComplianceOAuthState } =
  await import("@tamias/compliance");
const { normalizeAndValidatePath } = await import("../../api/src/rest/routers/files/utils");
const { encryptOAuthState } = await import("@tamias/encryption");

const tasks: Promise<unknown>[] = [];
const execution = {
  waitUntil: (promise: Promise<unknown>) => tasks.push(promise),
} as unknown as ExecutionContext;
let cacheTouched = false;
Object.defineProperty(globalThis, "caches", {
  configurable: true,
  value: {
    default: {
      match: () => {
        cacheTouched = true;
        return Response.json({ leaked: true });
      },
      put: () => {
        cacheTouched = true;
      },
    },
  },
});
const rest = new Hono();
rest.get("/scope-probe", withAuth, withRequiredScope("filings.write"), (c) => c.json({ ok: true }));
rest.route("/apps/hmrc-vat/install-url", installUrlRouter);
rest.route("/apps/hmrc-vat/oauth-callback", oauthCallbackRouter);
const { consumeRateLimit } = await import("../../api/src/rate-limit/shared");
const rateBuckets = new Map();
const runtime = {
  RATE_LIMIT_COORDINATOR: {
    getByName: (name: string) => ({
      consume: async (payload: Parameters<typeof consumeRateLimit>[1]) => {
        const result = consumeRateLimit(rateBuckets.get(name), payload);
        rateBuckets.set(name, result.bucket);
        return result.outcome;
      },
    }),
  },
};
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  fetch: (req) =>
    new URL(req.url).pathname.startsWith("/trpc/")
      ? handleTrpcFastPath(req, execution)
      : rest.fetch(req, runtime),
});
const findings: Array<{ check: string; status: string; detail?: string }> = [];
async function check(name: string, run: () => Promise<void> | void) {
  try {
    await run();
    findings.push({ check: name, status: "passed" });
    console.log(`PASS ${name}`);
  } catch (error) {
    findings.push({
      check: name,
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
    });
    console.log(`FAIL ${name}: ${error instanceof Error ? error.message : error}`);
  }
}
async function request(
  procedure: string,
  token?: string,
  body?: unknown,
  extra: Record<string, string> = {},
) {
  return fetch(`${server.url}trpc/${procedure}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify({ json: body }) }),
  });
}
const now = new Date().toISOString();
async function account(email: string) {
  const result = await handleDashboardAuthAction(
    {
      action: "auth:signIn",
      args: { params: { email, password: "synthetic-test-password-ONLY", flow: "signUp" } },
    },
    { db },
  );
  const user = sqlite.query("select id from users where email = ?").get(email) as { id: string };
  const team = crypto.randomUUID();
  sqlite
    .query("insert into teams (id, name, created_at, updated_at) values (?, ?, ?, ?)")
    .run(team, email, now, now);
  sqlite
    .query(
      "insert into team_memberships (id, team_id, user_id, role, created_at, updated_at) values (?, ?, ?, 'owner', ?, ?)",
    )
    .run(crypto.randomUUID(), team, user.id, now, now);
  sqlite.query("update users set current_team_id = ? where id = ?").run(team, user.id);
  return { userId: user.id, teamId: team, token: result.tokens!.token };
}
try {
  const alice = await account("alice@example.test");
  const bob = await account("bob@example.test");
  await check("Unauthenticated and forged sessions cannot read financial APIs", async () => {
    for (const token of [undefined, "forged.jwt.signature"])
      assert.equal((await request("user.me", token)).status, 401);
  });
  await check("Forged trusted-session headers cannot bypass authentication", async () => {
    assert.equal(
      (
        await request("user.me", undefined, undefined, {
          "x-dashboard-key": "wrong",
          "x-trusted-session": encodeURIComponent(
            JSON.stringify({ user: { id: alice.userId }, teamId: alice.teamId }),
          ),
        })
      ).status,
      401,
    );
  });
  await check("Authenticated responses are private and never touch shared cache", async () => {
    const a = await request("user.me", alice.token);
    assert.equal(a.status, 200);
    assert.match(a.headers.get("cache-control")!, /private, no-store/);
    assert.match(await a.text(), /alice@example.test/);
    const b = await request("user.me", bob.token);
    assert.equal(b.status, 200);
    assert.doesNotMatch(await b.text(), /alice@example.test/);
    assert.equal(cacheTouched, false);
  });
  await check(
    "Switching workspace with the same token returns current authorised data",
    async () => {
      sqlite
        .query(
          "insert into team_memberships (id, team_id, user_id, role, created_at, updated_at) values (?, ?, ?, 'member', ?, ?)",
        )
        .run(crypto.randomUUID(), bob.teamId, alice.userId, now, now);
      sqlite
        .query("update users set current_team_id = ? where id = ?")
        .run(bob.teamId, alice.userId);
      const response = await request("team.current", alice.token);
      assert.equal(response.status, 200);
      assert.match(await response.text(), /bob@example.test/);
      sqlite
        .query("delete from team_memberships where team_id = ? and user_id = ?")
        .run(bob.teamId, alice.userId);
      const denied = await request("team.current", alice.token);
      assert.notEqual(denied.status, 200);
      sqlite
        .query("update users set current_team_id = ? where id = ?")
        .run(alice.teamId, alice.userId);
    },
  );
  const apiKey = await createApiKeyInD1({
    db,
    userId: alice.userId,
    publicTeamId: alice.teamId,
    name: "Synthetic read only key",
    scopes: ["filings.read"],
  });
  await check("Scoped REST API keys cannot bypass scopes through dashboard tRPC", async () => {
    const key = apiKey.key;
    assert.equal((await request("user.me", key)).status, 401);
    const response = await fetch(`${server.url}scope-probe`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    assert.equal(response.status, 403);
  });
  await createApp(db, {
    teamId: alice.teamId,
    createdByUserId: alice.userId,
    appId: "hmrc-vat",
    config: {
      accessToken: "SECRET_ACCESS_TEST",
      refreshToken: "SECRET_REFRESH_TEST",
      nested: { clientSecret: "SECRET_CLIENT_TEST" },
    },
    settings: [{ id: "enabled", value: true }],
  });
  await check(
    "Integration read and update responses do not disclose provider credentials",
    async () => {
      for (const [proc, body] of [
        ["apps.get", undefined],
        ["apps.update", { appId: "hmrc-vat", option: { id: "enabled", value: false } }],
      ] as const) {
        const response = await request(proc, alice.token, body);
        assert.equal(response.status, 200);
        const text = await response.text();
        assert.doesNotMatch(text, /SECRET_|accessToken|refreshToken|clientSecret/);
      }
      const other = await request("apps.get", bob.token);
      assert.doesNotMatch(await other.text(), /hmrc-vat/);
    },
  );
  await check("Integration disconnect responses do not disclose removed credentials", async () => {
    const response = await request("apps.disconnect", alice.token, { appId: "hmrc-vat" });
    assert.equal(response.status, 200);
    assert.doesNotMatch(await response.text(), /SECRET_|accessToken|refreshToken/);
  });
  await check("CORS does not allow an attacker origin", async () => {
    const response = await request("user.me", alice.token, undefined, {
      Origin: "https://attacker.example",
    });
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  });
  await check("HMRC state rejects tampering and expired encrypted payloads", () => {
    const state = encryptComplianceOAuthState({
      teamId: alice.teamId,
      userId: alice.userId,
      provider: "hmrc-vat",
      source: "apps",
    });
    assert.ok(decryptComplianceOAuthState(state));
    assert.equal(decryptComplianceOAuthState(state + "tampered"), null);
    const expired = encryptOAuthState({
      teamId: alice.teamId,
      userId: alice.userId,
      provider: "hmrc-vat",
      source: "apps",
      issuedAt: Date.now() - 700000,
      expiresAt: Date.now() - 100000,
    });
    assert.equal(decryptComplianceOAuthState(expired), null);
  });
  await check("HMRC state is browser-bound and consumed atomically once", async () => {
    const state = crypto.randomUUID(),
      browser = crypto.randomUUID();
    await storeHmrcOAuthState(db, state, browser);
    assert.equal(await consumeHmrcOAuthState(db, state, "other-browser"), false);
    const results = await Promise.all([
      consumeHmrcOAuthState(db, state, browser),
      consumeHmrcOAuthState(db, state, browser),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
  });
  await check("HMRC callback rejects missing browser binding before token exchange", async () => {
    const response = await fetch(`${server.url}apps/hmrc-vat/install-url`, {
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie")!;
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    const consent = new URL(((await response.json()) as { url: string }).url);
    const state = consent.searchParams.get("state")!;
    const callback = await fetch(
      `${server.url}apps/hmrc-vat/oauth-callback?code=synthetic&state=${encodeURIComponent(state)}`,
    );
    assert.equal(callback.status, 400);
  });
  await check("File path validation rejects plain and encoded traversal", () => {
    for (const path of [
      "../secret.pdf",
      "%2e%2e/secret.pdf",
      "%252e%252e/secret.pdf",
      "folder/../../secret.pdf",
      "folder\\\\secret.pdf",
      "bad%00name",
    ])
      assert.throws(() => normalizeAndValidatePath(path, alice.teamId));
    assert.equal(
      normalizeAndValidatePath("receipts/invoice.pdf", alice.teamId).pathTeamId,
      alice.teamId,
    );
  });
  await check("Session revocation takes effect on the next request", async () => {
    sqlite
      .query("update auth_sessions set revoked_at = ? where user_id = ?")
      .run(now, alice.userId);
    assert.equal((await request("user.me", alice.token)).status, 401);
  });
} finally {
  server.stop(true);
  await Promise.allSettled(tasks);
  sqlite.close();
  globalThis.fetch = nativeFetch;
}
const report = {
  generatedAt: new Date().toISOString(),
  scope:
    "Local loopback HTTP; real auth and API handlers; in-memory SQL; synthetic accounts; external networking blocked",
  results: findings,
};
const output = process.argv[2];
if (output) writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(
  `${findings.filter((f) => f.status === "passed").length}/${findings.length} checks passed`,
);
if (findings.some((f) => f.status === "failed")) process.exitCode = 1;
