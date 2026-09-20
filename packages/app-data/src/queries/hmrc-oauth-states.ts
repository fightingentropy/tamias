import { createHash } from "node:crypto";
import { requireCloudflareD1Database, type Database } from "../client";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function storeHmrcOAuthState(db: Database, state: string, browserBinding: string) {
  const d1 = requireCloudflareD1Database(db);
  await d1.prepare("delete from hmrc_oauth_states where expires_at <= ?").bind(Date.now()).run();
  await d1
    .prepare(
      "insert into hmrc_oauth_states (state_hash, browser_hash, expires_at) values (?, ?, ?)",
    )
    .bind(hash(state), hash(browserBinding), Date.now() + 10 * 60 * 1000)
    .run();
}

export async function consumeHmrcOAuthState(db: Database, state: string, browserBinding: string) {
  if (!browserBinding || browserBinding.length > 128 || state.length > 4096) return false;
  const d1 = requireCloudflareD1Database(db);
  const row = await d1
    .prepare(
      "delete from hmrc_oauth_states where state_hash = ? and browser_hash = ? and expires_at > ? returning state_hash",
    )
    .bind(hash(state), hash(browserBinding), Date.now())
    .first();
  return Boolean(row);
}
