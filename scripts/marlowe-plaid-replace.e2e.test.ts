/**
 * Full backend E2E: Convex + Plaid Sandbox for Marlowe Walker.
 *
 * Skipped unless MARLOWE_PLAID_E2E=1. Requires CONVEX_URL, CONVEX_SERVICE_KEY (if not localhost),
 * PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENVIRONMENT=sandbox.
 *
 *   MARLOWE_PLAID_E2E=1 bun --env-file=.env test scripts/marlowe-plaid-replace.e2e.test.ts
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { getTransactionsFromConvex } from "../packages/app-data-convex/src/index";
import { loadRepoEnv } from "./lib/load-repo-env";
import { runMarlowePlaidReplace } from "./lib/run-marlowe-plaid-replace";

const e2eEnabled = process.env.MARLOWE_PLAID_E2E === "1";

describe.skipIf(!e2eEnabled)("Marlowe Plaid replace (backend E2E)", () => {
  beforeAll(() => {
    loadRepoEnv();

    if (!process.env.CONVEX_URL) {
      throw new Error("CONVEX_URL is required when MARLOWE_PLAID_E2E=1");
    }

    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
      throw new Error("PLAID_CLIENT_ID and PLAID_SECRET are required when MARLOWE_PLAID_E2E=1");
    }
  });

  test("replaces seed bank + seed-txn-* with Plaid sandbox /transactions/sync rows", async () => {
    const convexUrl = process.env.CONVEX_URL ?? "";
    const isLocal = convexUrl.includes("127.0.0.1") || convexUrl.includes("localhost");
    const allowProductionConvex = !isLocal;

    const userEmail = process.env.MARLOWE_PLAID_USER_EMAIL ?? "marlowe.walker@example.com";

    const result = await runMarlowePlaidReplace({
      userEmail,
      allowProductionConvex,
      plaidInstitutionId: process.env.MARLOWE_PLAID_INSTITUTION_ID,
      plaidSandboxTestUser: process.env.PLAID_SANDBOX_TEST_USER,
      log: () => undefined,
    });

    expect(result.totalTransactionsUpserted).toBeGreaterThan(0);
    expect(result.accounts.length).toBeGreaterThan(0);

    const txs = await getTransactionsFromConvex({
      teamId: result.teamId,
      limit: 800,
    });

    const stillSeed = txs.filter((t) => t.internalId.startsWith("seed-txn-"));
    expect(stillSeed).toEqual([]);

    const fromPlaid = txs.filter(
      (t) =>
        t.internalId.startsWith(`${result.teamId}_`) && !t.internalId.startsWith("seed-txn-"),
    );
    expect(fromPlaid.length).toBeGreaterThan(0);
  }, 120_000);
});
