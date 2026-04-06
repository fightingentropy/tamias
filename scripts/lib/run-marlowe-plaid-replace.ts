import { Provider } from "../../packages/banking/src/index";
import { PlaidApi } from "../../packages/banking/src/providers/plaid/plaid-api";
import type { Account } from "../../packages/banking/src/types";
import type { ConvexUserId } from "../../packages/app-data-convex/src/base";
import {
  createBankConnectionInConvex,
  deleteBankConnectionInConvex,
  deleteTransactionsInConvex,
  getBankConnectionsFromConvex,
  getTeamMembersFromConvexIdentity,
  getTransactionsFromConvex,
  listAllTeamsFromConvexIdentity,
  upsertTransactionsInConvex,
  type TeamIdentityRecord,
  type TeamMemberIdentityRecord,
} from "../../packages/app-data-convex/src/index";
import { buildMarlowePlaidUpsert } from "./marlowe-plaid-map";

const DEFAULT_PLAID_UK_SANDBOX_INSTITUTION_ID = "ins_116248";

export type MarlowePlaidReplaceResult = {
  teamId: string;
  userEmail: string;
  itemId: string;
  connectionId: string;
  totalTransactionsUpserted: number;
  accounts: Array<{ id: string; name: string | null; accountId: string }>;
};

export type RunMarlowePlaidReplaceOptions = {
  userEmail: string;
  /** Required when CONVEX_URL is not localhost (e.g. *.convex.cloud). */
  allowProductionConvex: boolean;
  plaidInstitutionId?: string;
  /** Override Plaid sandbox test user (default: user_transactions_dynamic). */
  plaidSandboxTestUser?: string;
  log?: (message: string) => void;
};

function accountsToConvexInput(accounts: Account[]) {
  return accounts.map((account) => ({
    accountId: account.id,
    institutionId: account.institution.id,
    logoUrl: account.institution.logo,
    name: account.name,
    bankName: account.institution.name,
    currency: account.currency,
    enabled: true as const,
    balance: account.balance.amount,
    type: account.type,
    accountReference: account.resource_id,
    iban: account.iban,
    subtype: account.subtype,
    bic: account.bic,
    routingNumber: account.routing_number,
    wireRoutingNumber: account.wire_routing_number,
    accountNumber: account.account_number,
    sortCode: account.sort_code,
    availableBalance: account.available_balance,
    creditLimit: account.credit_limit,
  }));
}

async function resolveOwnerByEmail(email: string): Promise<{
  team: TeamIdentityRecord;
  owner: TeamMemberIdentityRecord;
}> {
  const teams = await listAllTeamsFromConvexIdentity();

  for (const team of teams) {
    const members = await getTeamMembersFromConvexIdentity({ teamId: team.id });
    const owner = members.at(0);

    if (!owner) {
      continue;
    }

    const matchEmail = owner.user.email?.toLowerCase() === email.toLowerCase();
    const matchTeamEmail = team.email?.toLowerCase() === email.toLowerCase();

    if (matchEmail || matchTeamEmail) {
      return { team, owner };
    }
  }

  throw new Error(`No team owner found for email ${email}`);
}

/**
 * Backend-only: remove Marlowe seed bank + seed-txn-* rows, create Plaid Sandbox item, upsert real /transactions/sync rows.
 */
export async function runMarlowePlaidReplace(
  options: RunMarlowePlaidReplaceOptions,
): Promise<MarlowePlaidReplaceResult> {
  const {
    userEmail,
    allowProductionConvex,
    plaidInstitutionId,
    plaidSandboxTestUser,
    log = console.log,
  } = options;

  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("Missing CONVEX_URL");
  }

  if (!convexUrl.includes("127.0.0.1") && !convexUrl.includes("localhost") && !allowProductionConvex) {
    throw new Error(
      "Non-local CONVEX_URL requires allowProductionConvex: true (or use localhost Convex).",
    );
  }

  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    throw new Error("Missing PLAID_CLIENT_ID or PLAID_SECRET");
  }

  if ((process.env.PLAID_ENVIRONMENT ?? "sandbox").trim().toLowerCase() !== "sandbox") {
    throw new Error(
      "PLAID_ENVIRONMENT must be sandbox (sandboxPublicTokenCreate is sandbox-only).",
    );
  }

  const { team, owner } = await resolveOwnerByEmail(userEmail);
  const teamId = team.id;
  const userId = owner.user.convexId as ConvexUserId;

  log(`Team ${teamId} (owner ${userEmail})`);

  const connections = await getBankConnectionsFromConvex({ teamId });
  const seedConnection = connections.find((c) => c.referenceId === "seed-reference-main");

  const allTx = await getTransactionsFromConvex({ teamId });
  const seedTxnIds = allTx
    .filter((tx) => tx.internalId.startsWith("seed-txn-"))
    .map((tx) => tx.id);

  if (seedTxnIds.length > 0) {
    const chunk = 200;
    for (let i = 0; i < seedTxnIds.length; i += chunk) {
      await deleteTransactionsInConvex({
        teamId,
        transactionIds: seedTxnIds.slice(i, i + chunk),
      });
    }
    log(`Deleted ${seedTxnIds.length} seeded transactions (seed-txn-*).`);
  }

  if (seedConnection) {
    await deleteBankConnectionInConvex({ id: seedConnection.id, teamId });
    log(`Deleted seed bank connection ${seedConnection.id}.`);
  } else {
    log("No seed-reference-main connection; skipped bank connection delete.");
  }

  const plaidApi = new PlaidApi();
  const publicToken = await plaidApi.sandboxPublicTokenCreate({
    institutionId: plaidInstitutionId ?? DEFAULT_PLAID_UK_SANDBOX_INSTITUTION_ID,
    overrideUsername: plaidSandboxTestUser,
  });

  const exchange = await plaidApi.itemPublicTokenExchange({ publicToken });
  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;

  try {
    await plaidApi.sandboxFireTransactionsDefaultUpdate(accessToken);
  } catch {
    log("Plaid sandbox TRANSACTIONS DEFAULT_UPDATE webhook skipped (non-fatal).");
  }

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const item = await plaidApi.itemGet(accessToken);
  const institutionId = item.institution_id;

  if (!institutionId) {
    throw new Error("Plaid item missing institution_id");
  }

  const banking = new Provider({ provider: "plaid" });
  const plaidAccounts = await banking.getAccounts({
    accessToken,
    institutionId,
  });

  if (!plaidAccounts?.length) {
    throw new Error("Plaid returned no accounts for sandbox item.");
  }

  const created = await createBankConnectionInConvex({
    teamId,
    userId,
    provider: "plaid",
    accessToken,
    referenceId: itemId,
    enrollmentId: null,
    accounts: accountsToConvexInput(plaidAccounts),
  });

  if (!created) {
    throw new Error("createBankConnectionInConvex returned null");
  }

  log(`Created bank connection ${created.id} with ${created.bankAccounts.length} account(s).`);

  const now = new Date().toISOString();
  let totalUpserted = 0;

  for (const bankAccount of created.bankAccounts) {
    const plaidAccountId = bankAccount.accountId;
    const txs = await banking.getTransactions({
      accessToken,
      accountId: plaidAccountId,
      accountType: bankAccount.type ?? "depository",
      latest: false,
    });

    if (!txs?.length) {
      log(`No transactions for account ${bankAccount.name} (${plaidAccountId}).`);
      continue;
    }

    const rows = txs.map((transaction) =>
      buildMarlowePlaidUpsert({
        transaction,
        teamId,
        bankAccountPublicId: bankAccount.id,
        createdAt: now,
      }),
    );

    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      await upsertTransactionsInConvex({
        teamId,
        transactions: rows.slice(i, i + batchSize),
      });
    }

    totalUpserted += rows.length;
    log(`Upserted ${rows.length} transaction(s) for ${bankAccount.name}.`);
  }

  return {
    teamId,
    userEmail,
    itemId,
    connectionId: created.id,
    totalTransactionsUpserted: totalUpserted,
    accounts: created.bankAccounts.map((a) => ({
      id: a.id,
      name: a.name,
      accountId: a.accountId,
    })),
  };
}
