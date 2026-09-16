import {
  createDatabase,
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "@tamias/app-data/client";
import { ensureUserInD1, getUserByIdFromD1, requireIdentityD1 } from "@tamias/app-data/queries";
import { createAccessToken, verifyAccessToken } from "@tamias/auth-session";
import { normalizeEmail } from "@tamias/domain/identity";
import { timingSafeEqual } from "node:crypto";

type AuthTokens = {
  token: string;
  refreshToken: string;
};

export type DashboardAuthAction = "auth:signIn" | "auth:signOut";

export type DashboardAuthActionInput = {
  action: DashboardAuthAction;
  args?: Record<string, unknown>;
};

export type DashboardAuthActionOptions = {
  db?: Database;
  accessToken?: string | null;
  userAgent?: string | null;
  ip?: string | null;
};

type AuthAccountRow = {
  id: string;
  user_id: string;
  provider: string;
  provider_account_id: string;
  secret_hash: string | null;
};

type RefreshTokenRow = {
  id: string;
  session_id: string;
  user_id: string;
  expires_at: string;
  session_expires_at: string;
  session_revoked_at: string | null;
};

const ACCESS_TOKEN_EXPIRES_IN = "15m";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_ITERATIONS = 100_000;
const PASSWORD_ALGORITHM = "pbkdf2-sha256";
const textEncoder = new TextEncoder();

function authD1(db: Database = createDatabase()) {
  return requireCloudflareD1Database(db);
}

function nowIso() {
  return new Date().toISOString();
}

function futureIso(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

function toBase64Url(bytes: Uint8Array) {
  const binary = Array.from(bytes, (value) => String.fromCharCode(value)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function randomToken(prefix: string, bytes = 32) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return `${prefix}${toBase64Url(buffer)}`;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return toBase64Url(new Uint8Array(digest));
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const passwordBytes = textEncoder.encode(password);
  const key = await crypto.subtle.importKey("raw", toArrayBuffer(passwordBytes), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return toBase64Url(new Uint8Array(bits));
}

async function hashPassword(password: string) {
  if (password.length < 8) {
    throw new Error("Invalid password");
  }

  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const digest = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  return `${PASSWORD_ALGORITHM}$${PASSWORD_ITERATIONS}$${toBase64Url(salt)}$${digest}`;
}

async function verifyPassword(password: string, persistedHash: string | null) {
  if (!persistedHash) {
    return false;
  }

  const [algorithm, iterationsRaw, saltRaw, digest] = persistedHash.split("$");
  const iterations = Number(iterationsRaw);

  if (algorithm !== PASSWORD_ALGORITHM || !Number.isFinite(iterations) || !saltRaw || !digest) {
    return false;
  }

  const computed = await derivePassword(password, fromBase64Url(saltRaw), iterations);
  const left = textEncoder.encode(computed);
  const right = textEncoder.encode(digest);
  return left.length === right.length && timingSafeEqual(left, right);
}

function readPasswordParams(args: Record<string, unknown>) {
  const provider = typeof args.provider === "string" ? args.provider : "password";
  const params = args.params;

  if (provider !== "password") {
    throw new Error("Unsupported auth provider");
  }

  if (!params || typeof params !== "object") {
    throw new Error("Invalid auth params");
  }

  const record = params as Record<string, unknown>;
  const email = normalizeEmail(typeof record.email === "string" ? record.email : null);
  const password = typeof record.password === "string" ? record.password : "";
  const flow = record.flow === "signUp" ? "signUp" : "signIn";

  if (!email) {
    throw new Error("InvalidAccountId");
  }

  if (password.length < 8) {
    throw new Error("Invalid password");
  }

  return { email, password, flow };
}

async function getPasswordAccount(d1: CloudflareD1DatabaseBinding, email: string) {
  return d1
    .prepare(
      `select *
      from auth_accounts
      where provider = 'password' and provider_account_id = ?
      limit 1`,
    )
    .bind(email)
    .first<AuthAccountRow>();
}

async function createSessionTokens(
  d1: CloudflareD1DatabaseBinding,
  args: {
    userId: string;
    userAgent?: string | null;
    ip?: string | null;
    passwordAccount: { id: string; secretHash: string };
  },
): Promise<AuthTokens> {
  const timestamp = nowIso();
  const sessionId = crypto.randomUUID();
  const refreshTokenId = crypto.randomUUID();
  const refreshToken = randomToken("tamias_rt_");
  const user = await getUserByIdFromD1(d1, args.userId);

  if (!user) {
    throw new Error("Auth user not found");
  }

  const session = await d1
    .prepare(
      `insert into auth_sessions (
        id,
        user_id,
        expires_at,
        created_at,
        updated_at,
        last_used_at,
        user_agent,
        ip_hash
      ) select ?, ?, ?, ?, ?, ?, ?, ?
      where exists (
        select 1 from auth_accounts where id = ? and secret_hash = ?
      ) returning id`,
    )
    .bind(
      sessionId,
      user.id,
      futureIso(SESSION_TTL_MS),
      timestamp,
      timestamp,
      timestamp,
      args.userAgent ?? null,
      args.ip ? await sha256(args.ip) : null,
      args.passwordAccount.id,
      args.passwordAccount.secretHash,
    )
    .first<{ id: string }>();

  if (!session) {
    throw new Error("InvalidSecret");
  }

  await d1
    .prepare(
      `insert into auth_refresh_tokens (
        id,
        session_id,
        token_hash,
        expires_at,
        created_at
      ) values (?, ?, ?, ?, ?)`,
    )
    .bind(
      refreshTokenId,
      sessionId,
      await sha256(refreshToken),
      futureIso(SESSION_TTL_MS),
      timestamp,
    )
    .run();

  return {
    token: await createAccessToken(user, {
      sessionId,
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    }),
    refreshToken,
  };
}

async function signUpWithPassword(
  d1: CloudflareD1DatabaseBinding,
  args: ReturnType<typeof readPasswordParams>,
  options: DashboardAuthActionOptions,
) {
  const existingAccount = await getPasswordAccount(d1, args.email);

  if (existingAccount) {
    throw new Error(`Account ${args.email} already exists`);
  }

  const user = await ensureUserInD1(d1, {
    email: args.email,
    authUserId: null,
  });

  if (!user) {
    throw new Error("Failed to create user");
  }

  const timestamp = nowIso();

  await d1
    .prepare(
      "update users set auth_user_id = coalesce(auth_user_id, id), updated_at = ? where id = ?",
    )
    .bind(timestamp, user.id)
    .run();

  const accountId = crypto.randomUUID();
  const secretHash = await hashPassword(args.password);
  await d1
    .prepare(
      `insert into auth_accounts (
        id,
        user_id,
        provider,
        provider_account_id,
        secret_hash,
        created_at,
        updated_at
      ) values (?, ?, 'password', ?, ?, ?, ?)`,
    )
    .bind(accountId, user.id, args.email, secretHash, timestamp, timestamp)
    .run();

  return {
    tokens: await createSessionTokens(d1, {
      userId: user.id,
      userAgent: options.userAgent,
      ip: options.ip,
      passwordAccount: { id: accountId, secretHash },
    }),
  };
}

async function signInWithPassword(
  d1: CloudflareD1DatabaseBinding,
  args: ReturnType<typeof readPasswordParams>,
  options: DashboardAuthActionOptions,
) {
  const account = await getPasswordAccount(d1, args.email);

  if (!account || !(await verifyPassword(args.password, account.secret_hash))) {
    throw new Error("InvalidSecret");
  }

  return {
    tokens: await createSessionTokens(d1, {
      userId: account.user_id,
      userAgent: options.userAgent,
      ip: options.ip,
      passwordAccount: { id: account.id, secretHash: account.secret_hash! },
    }),
  };
}

async function refreshSession(
  d1: CloudflareD1DatabaseBinding,
  refreshToken: string,
  options: DashboardAuthActionOptions,
) {
  const timestamp = nowIso();
  const tokenHash = await sha256(refreshToken);
  const row = await d1
    .prepare(
      `select
        auth_refresh_tokens.id,
        auth_refresh_tokens.session_id,
        auth_sessions.user_id,
        auth_refresh_tokens.expires_at,
        auth_sessions.expires_at as session_expires_at,
        auth_sessions.revoked_at as session_revoked_at
      from auth_refresh_tokens
      join auth_sessions on auth_sessions.id = auth_refresh_tokens.session_id
      where auth_refresh_tokens.token_hash = ?
        and auth_refresh_tokens.revoked_at is null
        and auth_refresh_tokens.expires_at > ?
      limit 1`,
    )
    .bind(tokenHash, timestamp)
    .first<RefreshTokenRow>();

  if (!row || row.session_revoked_at || row.session_expires_at <= timestamp) {
    return { tokens: null };
  }

  const nextRefreshToken = randomToken("tamias_rt_");

  await d1
    .prepare(
      "update auth_refresh_tokens set first_used_at = coalesce(first_used_at, ?), revoked_at = ? where id = ?",
    )
    .bind(timestamp, timestamp, row.id)
    .run();
  await d1
    .prepare(
      `insert into auth_refresh_tokens (
        id,
        session_id,
        token_hash,
        parent_refresh_token_id,
        expires_at,
        created_at
      ) values (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      row.session_id,
      await sha256(nextRefreshToken),
      row.id,
      futureIso(SESSION_TTL_MS),
      timestamp,
    )
    .run();
  await d1
    .prepare(
      "update auth_sessions set last_used_at = ?, updated_at = ?, user_agent = coalesce(?, user_agent), ip_hash = coalesce(?, ip_hash) where id = ?",
    )
    .bind(
      timestamp,
      timestamp,
      options.userAgent ?? null,
      options.ip ? await sha256(options.ip) : null,
      row.session_id,
    )
    .run();

  const user = await getUserByIdFromD1(d1, row.user_id);

  if (!user) {
    return { tokens: null };
  }

  return {
    tokens: {
      token: await createAccessToken(user, {
        sessionId: row.session_id,
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      }),
      refreshToken: nextRefreshToken,
    },
  };
}

async function signOut(d1: CloudflareD1DatabaseBinding, options: DashboardAuthActionOptions) {
  const timestamp = nowIso();
  const identity = await verifyAccessToken(options.accessToken ?? undefined);

  if (identity?.session_id) {
    await d1
      .prepare("update auth_sessions set revoked_at = ?, updated_at = ? where id = ?")
      .bind(timestamp, timestamp, identity.session_id)
      .run();
    await d1
      .prepare(
        "update auth_refresh_tokens set revoked_at = ? where session_id = ? and revoked_at is null",
      )
      .bind(timestamp, identity.session_id)
      .run();
  }

  return null;
}

export async function handleDashboardAuthAction(
  input: DashboardAuthActionInput,
  options: DashboardAuthActionOptions = {},
) {
  const d1 = authD1(options.db);

  if (input.action === "auth:signOut") {
    return signOut(d1, options);
  }

  if (input.action !== "auth:signIn") {
    throw new Error("Invalid auth action");
  }

  const args = input.args ?? {};
  const refreshToken = typeof args.refreshToken === "string" ? args.refreshToken : null;

  if (refreshToken) {
    return refreshSession(d1, refreshToken, options);
  }

  const passwordParams = readPasswordParams(args);

  if (passwordParams.flow === "signUp") {
    return signUpWithPassword(
      requireIdentityD1(options.db ?? createDatabase()),
      passwordParams,
      options,
    );
  }

  return signInWithPassword(d1, passwordParams, options);
}

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
const PASSWORD_RESET_COOLDOWN_MS = 5 * 60 * 1000;

export class InvalidPasswordResetError extends Error {
  constructor() {
    super("This reset link has expired or already been used. Request a new link.");
  }
}

/** Only a hash is persisted; the delivery callback is the sole recipient of the raw token. */
export async function requestPasswordReset(
  email: string,
  deliver: (email: string, token: string) => Promise<void>,
  db: Database = createDatabase(),
) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;

  const d1 = authD1(db);
  const token = randomToken("tamias_pr_");
  const tokenHash = await sha256(token);
  const timestamp = nowIso();
  const row = await d1
    .prepare(
      `insert into auth_password_resets (token_hash, account_id, created_at, expires_at)
       select ?, id, ?, ? from auth_accounts
       where provider = 'password' and provider_account_id = ?
         and not exists (
           select 1 from auth_password_resets
           where account_id = auth_accounts.id and created_at > ?
         )
       returning account_id`,
    )
    .bind(
      tokenHash,
      timestamp,
      futureIso(PASSWORD_RESET_TTL_MS),
      normalizedEmail,
      new Date(Date.now() - PASSWORD_RESET_COOLDOWN_MS).toISOString(),
    )
    .first<{ account_id: string }>();

  if (!row) return;

  try {
    await deliver(normalizedEmail, token);
  } catch {
    await d1.prepare("delete from auth_password_resets where token_hash = ?").bind(tokenHash).run();
    throw new Error("Password reset email delivery failed");
  }
}

export async function completePasswordReset(
  token: string,
  password: string,
  db: Database = createDatabase(),
) {
  if (!/^tamias_pr_[A-Za-z0-9_-]{43}$/.test(token)) throw new InvalidPasswordResetError();
  if (password.length < 8 || password.length > 128) {
    throw new Error("Use a password between 8 and 128 characters.");
  }

  const d1 = authD1(db);
  const tokenHash = await sha256(token);
  const account = await d1
    .prepare(
      `select a.provider_account_id as email from auth_password_resets r
       join auth_accounts a on a.id = r.account_id and a.provider = 'password'
       where r.token_hash = ? and r.used_at is null and r.expires_at > ?`,
    )
    .bind(tokenHash, nowIso())
    .first<{ email: string }>();
  if (!account) throw new InvalidPasswordResetError();

  const secretHash = await hashPassword(password);
  const timestamp = nowIso();
  const claimId = crypto.randomUUID();
  // Every mutation is conditional on this attempt claiming the token. D1 executes
  // the batch in one transaction, so concurrent requests cannot reuse a reset link.
  const claimedAccount = `select account_id from auth_password_resets where token_hash = ? and claim_id = ?`;
  const claimedUser = `select user_id from auth_accounts where id in (${claimedAccount})`;
  const [claim] = await d1.batch([
    d1
      .prepare(
        `update auth_password_resets set used_at = ?, claim_id = ?
         where token_hash = ? and used_at is null and expires_at > ? returning account_id`,
      )
      .bind(timestamp, claimId, tokenHash, timestamp),
    d1
      .prepare(
        `update auth_accounts set secret_hash = ?, updated_at = ? where id in (${claimedAccount})`,
      )
      .bind(secretHash, timestamp, tokenHash, claimId),
    d1
      .prepare(
        `update auth_sessions set revoked_at = ?, updated_at = ?
         where user_id in (${claimedUser}) and revoked_at is null`,
      )
      .bind(timestamp, timestamp, tokenHash, claimId),
    d1
      .prepare(
        `update auth_refresh_tokens set revoked_at = ? where revoked_at is null
         and session_id in (select id from auth_sessions where user_id in (${claimedUser}))`,
      )
      .bind(timestamp, tokenHash, claimId),
    d1
      .prepare(
        `update auth_password_resets set used_at = ? where used_at is null
         and account_id in (${claimedAccount})`,
      )
      .bind(timestamp, tokenHash, claimId),
  ]);
  if (!claim?.results?.length) throw new InvalidPasswordResetError();
  return { email: account.email };
}

export async function getActiveAuthIdentity(accessToken?: string, db: Database = createDatabase()) {
  const identity = await verifyAccessToken(accessToken);
  if (!identity?.subject || !identity.session_id) return null;

  const session = await authD1(db)
    .prepare(
      `select id from auth_sessions where id = ? and user_id = ?
       and revoked_at is null and expires_at > ?`,
    )
    .bind(identity.session_id, identity.subject, nowIso())
    .first<{ id: string }>();
  return session ? identity : null;
}
