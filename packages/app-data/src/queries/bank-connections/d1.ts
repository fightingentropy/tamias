import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type {
  BankAccountConnectionRecord as BankConnectionRecord,
  BankAccountRecord,
  BankAccountType,
  BankConnectionProvider,
  BankConnectionStatus,
} from "../bank-accounts/types";
import {
  getBankAccountByIdFromD1,
  getBankAccountsFromD1,
  upsertBankAccountsInD1,
  type BankAccountsD1Filter,
} from "../bank-accounts/d1";

type BankConnectionRow = {
  id: string;
  created_at: string;
  institution_id: string;
  expires_at: string | null;
  team_id: string;
  name: string;
  logo_url: string | null;
  access_token: string | null;
  provider: BankConnectionProvider;
  last_accessed: string | null;
  reference_id: string | null;
  status: BankConnectionStatus | null;
  error_details: string | null;
  error_retries: number | null;
  updated_at: string;
};

export type BankConnectionsD1Filter = {
  teamId: string;
  enabled?: boolean;
};

export type BankProviderAccountD1Input = {
  id?: string;
  accountId: string;
  institutionId?: string;
  logoUrl?: string | null;
  name: string;
  bankName?: string;
  currency: string;
  enabled?: boolean;
  balance?: number;
  type: BankAccountType;
  accountReference?: string | null;
  expiresAt?: string | null;
  iban?: string | null;
  subtype?: string | null;
  bic?: string | null;
  routingNumber?: string | null;
  wireRoutingNumber?: string | null;
  accountNumber?: string | null;
  sortCode?: string | null;
  availableBalance?: number | null;
  creditLimit?: number | null;
};

export type CreateBankConnectionInD1Params = {
  id?: string;
  teamId: string;
  userId: string;
  provider: BankConnectionProvider;
  accounts: BankProviderAccountD1Input[];
  accessToken?: string | null;
  referenceId?: string | null;
};

export type PatchBankConnectionInD1Params = {
  id: string;
  teamId?: string;
  accessToken?: string | null;
  status?: BankConnectionStatus | null;
  lastAccessed?: string | null;
  errorDetails?: string | null;
  errorRetries?: number | null;
  referenceId?: string | null;
  expiresAt?: string | null;
};

export function getBankConnectionsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

export function requireBankConnectionsD1(db: Database) {
  const d1 = getBankConnectionsD1(db);

  if (!d1) {
    throw new Error("Bank connections require Cloudflare D1");
  }

  return d1;
}

function toBankConnectionRecord(
  row: BankConnectionRow,
  bankAccounts: BankAccountRecord[] = [],
): BankConnectionRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    institutionId: row.institution_id,
    expiresAt: row.expires_at,
    teamId: row.team_id,
    name: row.name,
    logoUrl: row.logo_url,
    accessToken: row.access_token,
    provider: row.provider,
    lastAccessed: row.last_accessed,
    referenceId: row.reference_id,
    status: row.status,
    errorDetails: row.error_details,
    errorRetries: row.error_retries,
    bankAccounts,
  };
}

function toEmbeddedConnection(connection: BankConnectionRecord): BankConnectionRecord {
  return {
    ...connection,
    bankAccounts: [],
  };
}

function attachConnectionToAccounts(connection: BankConnectionRecord): BankAccountRecord[] {
  const embeddedConnection = toEmbeddedConnection(connection);

  return connection.bankAccounts.map((account) => ({
    ...account,
    bankConnection: account.bankConnection ?? embeddedConnection,
  }));
}

function createAccountsForConnection(args: {
  connection: BankConnectionRecord;
  createdBy: string;
  accounts: BankProviderAccountD1Input[];
}) {
  const embeddedConnection = toEmbeddedConnection(args.connection);
  const timestamp = new Date().toISOString();

  return args.accounts.map(
    (account): BankAccountRecord => ({
      id: account.id ?? crypto.randomUUID(),
      createdAt: timestamp,
      createdBy: args.createdBy,
      teamId: args.connection.teamId,
      name: account.name,
      currency: account.currency,
      bankConnectionId: args.connection.id,
      enabled: account.enabled ?? true,
      accountId: account.accountId,
      balance: account.balance ?? null,
      manual: false,
      type: account.type,
      baseCurrency: null,
      baseBalance: null,
      errorDetails: null,
      errorRetries: null,
      accountReference: account.accountReference ?? null,
      iban: account.iban ?? null,
      subtype: account.subtype ?? null,
      bic: account.bic ?? null,
      routingNumber: account.routingNumber ?? null,
      wireRoutingNumber: account.wireRoutingNumber ?? null,
      accountNumber: account.accountNumber ?? null,
      sortCode: account.sortCode ?? null,
      availableBalance: account.availableBalance ?? null,
      creditLimit: account.creditLimit ?? null,
      bankConnection: embeddedConnection,
    }),
  );
}

async function getAccountsByConnection(
  d1: CloudflareD1DatabaseBinding,
  params: BankAccountsD1Filter,
) {
  const accounts = await getBankAccountsFromD1(d1, params);
  const byConnectionId = new Map<string, BankAccountRecord[]>();

  for (const account of accounts) {
    if (!account.bankConnectionId) {
      continue;
    }

    const current = byConnectionId.get(account.bankConnectionId) ?? [];
    current.push(account);
    byConnectionId.set(account.bankConnectionId, current);
  }

  return byConnectionId;
}

export async function upsertBankConnectionInD1(
  d1: CloudflareD1DatabaseBinding,
  connection: BankConnectionRecord,
) {
  await d1
    .prepare(
      `insert into bank_connections (
        id,
        created_at,
        institution_id,
        expires_at,
        team_id,
        name,
        logo_url,
        access_token,
        provider,
        last_accessed,
        reference_id,
        status,
        error_details,
        error_retries,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        created_at = excluded.created_at,
        institution_id = excluded.institution_id,
        expires_at = excluded.expires_at,
        team_id = excluded.team_id,
        name = excluded.name,
        logo_url = excluded.logo_url,
        access_token = excluded.access_token,
        provider = excluded.provider,
        last_accessed = excluded.last_accessed,
        reference_id = excluded.reference_id,
        status = excluded.status,
        error_details = excluded.error_details,
        error_retries = excluded.error_retries,
        updated_at = excluded.updated_at`,
    )
    .bind(
      connection.id,
      connection.createdAt,
      connection.institutionId,
      connection.expiresAt,
      connection.teamId,
      connection.name,
      connection.logoUrl,
      connection.accessToken,
      connection.provider,
      connection.lastAccessed,
      connection.referenceId,
      connection.status,
      connection.errorDetails,
      connection.errorRetries,
      new Date().toISOString(),
    )
    .run();

  await upsertBankAccountsInD1(d1, attachConnectionToAccounts(connection));
}

export async function createBankConnectionInD1(
  d1: CloudflareD1DatabaseBinding,
  params: CreateBankConnectionInD1Params,
) {
  const [firstAccount] = params.accounts;

  if (!firstAccount) {
    return null;
  }

  const timestamp = new Date().toISOString();
  const connection: BankConnectionRecord = {
    id: params.id ?? crypto.randomUUID(),
    createdAt: timestamp,
    institutionId: firstAccount.institutionId ?? firstAccount.accountId,
    expiresAt: firstAccount.expiresAt ?? null,
    teamId: params.teamId,
    name: firstAccount.bankName ?? firstAccount.name,
    logoUrl: firstAccount.logoUrl ?? null,
    accessToken: params.accessToken ?? null,
    provider: params.provider,
    lastAccessed: null,
    referenceId: params.referenceId ?? null,
    status: "connected",
    errorDetails: null,
    errorRetries: null,
    bankAccounts: [],
  };
  connection.bankAccounts = createAccountsForConnection({
    connection,
    createdBy: params.userId,
    accounts: params.accounts,
  });

  await upsertBankConnectionInD1(d1, connection);

  return connection;
}

export async function addProviderAccountsInD1(
  d1: CloudflareD1DatabaseBinding,
  params: {
    connectionId: string;
    teamId: string;
    userId: string;
    accounts: BankProviderAccountD1Input[];
  },
) {
  const connection = await getBankConnectionByIdFromD1(d1, { id: params.connectionId });

  if (!connection || connection.teamId !== params.teamId) {
    return [];
  }

  const accounts = createAccountsForConnection({
    connection,
    createdBy: params.userId,
    accounts: params.accounts,
  });

  await upsertBankAccountsInD1(d1, accounts);

  return accounts;
}

export async function patchBankConnectionInD1(
  d1: CloudflareD1DatabaseBinding,
  params: PatchBankConnectionInD1Params,
) {
  const connection = await getBankConnectionByIdFromD1(d1, { id: params.id });

  if (!connection || (params.teamId && connection.teamId !== params.teamId)) {
    return null;
  }

  const updated: BankConnectionRecord = {
    ...connection,
    accessToken: params.accessToken !== undefined ? params.accessToken : connection.accessToken,
    status: params.status !== undefined ? params.status : connection.status,
    lastAccessed: params.lastAccessed !== undefined ? params.lastAccessed : connection.lastAccessed,
    errorDetails: params.errorDetails !== undefined ? params.errorDetails : connection.errorDetails,
    errorRetries: params.errorRetries !== undefined ? params.errorRetries : connection.errorRetries,
    referenceId: params.referenceId !== undefined ? params.referenceId : connection.referenceId,
    expiresAt: params.expiresAt !== undefined ? params.expiresAt : connection.expiresAt,
  };

  await upsertBankConnectionInD1(d1, updated);

  return updated;
}

export async function getBankConnectionsFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: BankConnectionsD1Filter,
) {
  const [{ results = [] }, accountsByConnectionId] = await Promise.all([
    d1
      .prepare(
        `select *
         from bank_connections
         where team_id = ?
         order by created_at asc, name asc`,
      )
      .bind(params.teamId)
      .all<BankConnectionRow>(),
    getAccountsByConnection(d1, {
      teamId: params.teamId,
      enabled: params.enabled,
    }),
  ]);

  return results.map((row) =>
    toBankConnectionRecord(row, accountsByConnectionId.get(row.id) ?? []),
  );
}

export async function getBankConnectionByReferenceIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { referenceId: string },
) {
  const row = await d1
    .prepare("select * from bank_connections where reference_id = ? limit 1")
    .bind(params.referenceId)
    .first<BankConnectionRow>();

  if (!row) {
    return null;
  }

  const accountsByConnectionId = await getAccountsByConnection(d1, {
    teamId: row.team_id,
  });

  return toBankConnectionRecord(row, accountsByConnectionId.get(row.id) ?? []);
}

export async function getBankConnectionByIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { id: string },
) {
  const row = await d1
    .prepare("select * from bank_connections where id = ? limit 1")
    .bind(params.id)
    .first<BankConnectionRow>();

  if (!row) {
    return null;
  }

  const accountsByConnectionId = await getAccountsByConnection(d1, {
    teamId: row.team_id,
  });

  return toBankConnectionRecord(row, accountsByConnectionId.get(row.id) ?? []);
}

export async function getBankAccountDetailsFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { accountId: string; teamId: string },
) {
  const account = await getBankAccountByIdFromD1(d1, {
    id: params.accountId,
    teamId: params.teamId,
  });

  if (!account) {
    return null;
  }

  return {
    id: account.id,
    iban: account.iban,
    accountNumber: account.accountNumber,
    routingNumber: account.routingNumber,
    wireRoutingNumber: account.wireRoutingNumber,
    bic: account.bic,
    sortCode: account.sortCode,
  };
}

export async function getBankAccountsWithPaymentInfoFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string },
) {
  const accounts = await getBankAccountsFromD1(d1, {
    teamId: params.teamId,
    enabled: true,
  });

  return accounts
    .filter(
      (account) =>
        !!account.iban ||
        !!account.accountNumber ||
        !!account.routingNumber ||
        !!account.wireRoutingNumber ||
        !!account.bic ||
        !!account.sortCode,
    )
    .map((account) => ({
      id: account.id,
      name: account.name ?? "",
      bankName: account.bankConnection?.name ?? null,
      currency: account.currency,
      iban: account.iban,
      accountNumber: account.accountNumber,
      routingNumber: account.routingNumber,
      wireRoutingNumber: account.wireRoutingNumber,
      bic: account.bic,
      sortCode: account.sortCode,
    }));
}

export async function deleteBankConnectionFromD1(
  db: Database,
  params: { id: string; teamId: string },
) {
  const d1 = getBankConnectionsD1(db);

  if (!d1) {
    return;
  }

  await d1
    .prepare("delete from bank_accounts where bank_connection_id = ? and team_id = ?")
    .bind(params.id, params.teamId)
    .run();
  await d1
    .prepare("delete from bank_connections where id = ? and team_id = ?")
    .bind(params.id, params.teamId)
    .run();
}
