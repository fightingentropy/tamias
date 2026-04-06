/**
 * CLI wrapper for `runMarlowePlaidReplace`. See `scripts/lib/run-marlowe-plaid-replace.ts`.
 *
 *   bun --env-file=.env run scripts/seed-marlowe-plaid-replace.ts --production-convex
 */

import { loadRepoEnv } from "./lib/load-repo-env";
import { runMarlowePlaidReplace } from "./lib/run-marlowe-plaid-replace";

const DEFAULT_USER_EMAIL = "marlowe.walker@example.com";

loadRepoEnv();

const convexUrl = process.env.CONVEX_URL;

if (!convexUrl) {
  throw new Error("Missing CONVEX_URL");
}

const allowProductionConvex =
  process.argv.includes("--allow-remote") || process.argv.includes("--production-convex");

if (!convexUrl.includes("127.0.0.1") && !convexUrl.includes("localhost") && !allowProductionConvex) {
  throw new Error(
    "Refusing to run against a non-local Convex deployment. Pass --production-convex (or --allow-remote).",
  );
}

function argValue(flag: string): string | null {
  const direct = process.argv.find((item) => item.startsWith(`${flag}=`));
  if (direct) {
    return direct.slice(flag.length + 1);
  }

  const index = process.argv.indexOf(flag);
  if (index >= 0) {
    return process.argv[index + 1] ?? null;
  }

  return null;
}

const result = await runMarlowePlaidReplace({
  userEmail: argValue("--user-email") ?? DEFAULT_USER_EMAIL,
  allowProductionConvex,
  plaidInstitutionId: argValue("--plaid-institution-id") ?? undefined,
  plaidSandboxTestUser: argValue("--plaid-sandbox-user") ?? undefined,
});

console.log(JSON.stringify({ ok: true, ...result }, null, 2));
