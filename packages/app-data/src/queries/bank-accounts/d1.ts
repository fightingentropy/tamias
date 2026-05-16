import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";
import type { BankAccountRecord, CreateBankAccountParams, PatchBankAccountParams } from "./types";

type BankAccountRow = {
  id: string;
  created_at: string;
  created_by: string | null;
  team_id: string;
  name: string | null;
  currency: string | null;
  bank_connection_id: string | null;
  enabled: number;
  account_id: string;
  balance: number | null;
  manual: number;
  type: BankAccountRecord["type"] | null;
  base_currency: string | null;
  base_balance: number | null;
  error_details: string | null;
  error_retries: number | null;
  account_reference: string | null;
  iban: string | null;
  subtype: string | null;
  bic: string | null;
  routing_number: string | null;
  wire_routing_number: string | null;
  account_number: string | null;
  sort_code: string | null;
  available_balance: number | null;
  credit_limit: number | null;
  bank_connection_json: string | null;
  updated_at: string;
};

export type BankAccountsD1Filter = {
  teamId: string;
  enabled?: boolean;
  manual?: boolean;
};

export function getBankAccountsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

export function requireBankAccountsD1(db: Database) {
  const d1 = getBankAccountsD1(db);

  if (!d1) {
    throw new Error("Bank accounts require Cloudflare D1");
  }

  return d1;
}

function parseBankConnection(value: string | null): BankAccountRecord["bankConnection"] {
  if (!value) {
    return null;
  }

  return JSON.parse(value) as BankAccountRecord["bankConnection"];
}

function toBoolean(value: number | boolean) {
  return value === true || value === 1;
}

function toBankAccountRecord(row: BankAccountRow): BankAccountRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    createdBy: row.created_by,
    teamId: row.team_id,
    name: row.name,
    currency: row.currency,
    bankConnectionId: row.bank_connection_id,
    enabled: toBoolean(row.enabled),
    accountId: row.account_id,
    balance: row.balance,
    manual: toBoolean(row.manual),
    type: row.type,
    baseCurrency: row.base_currency,
    baseBalance: row.base_balance,
    errorDetails: row.error_details,
    errorRetries: row.error_retries,
    accountReference: row.account_reference,
    iban: row.iban,
    subtype: row.subtype,
    bic: row.bic,
    routingNumber: row.routing_number,
    wireRoutingNumber: row.wire_routing_number,
    accountNumber: row.account_number,
    sortCode: row.sort_code,
    availableBalance: row.available_balance,
    creditLimit: row.credit_limit,
    bankConnection: parseBankConnection(row.bank_connection_json),
  };
}

export async function upsertBankAccountInD1(
  d1: CloudflareD1DatabaseBinding,
  account: BankAccountRecord,
) {
  await d1
    .prepare(
      `insert into bank_accounts (
        id,
        created_at,
        created_by,
        team_id,
        name,
        currency,
        bank_connection_id,
        enabled,
        account_id,
        balance,
        manual,
        type,
        base_currency,
        base_balance,
        error_details,
        error_retries,
        account_reference,
        iban,
        subtype,
        bic,
        routing_number,
        wire_routing_number,
        account_number,
        sort_code,
        available_balance,
        credit_limit,
        bank_connection_json,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        created_at = excluded.created_at,
        created_by = excluded.created_by,
        team_id = excluded.team_id,
        name = excluded.name,
        currency = excluded.currency,
        bank_connection_id = excluded.bank_connection_id,
        enabled = excluded.enabled,
        account_id = excluded.account_id,
        balance = excluded.balance,
        manual = excluded.manual,
        type = excluded.type,
        base_currency = excluded.base_currency,
        base_balance = excluded.base_balance,
        error_details = excluded.error_details,
        error_retries = excluded.error_retries,
        account_reference = excluded.account_reference,
        iban = excluded.iban,
        subtype = excluded.subtype,
        bic = excluded.bic,
        routing_number = excluded.routing_number,
        wire_routing_number = excluded.wire_routing_number,
        account_number = excluded.account_number,
        sort_code = excluded.sort_code,
        available_balance = excluded.available_balance,
        credit_limit = excluded.credit_limit,
        bank_connection_json = excluded.bank_connection_json,
        updated_at = excluded.updated_at`,
    )
    .bind(
      account.id,
      account.createdAt,
      account.createdBy,
      account.teamId,
      account.name,
      account.currency,
      account.bankConnectionId,
      account.enabled ? 1 : 0,
      account.accountId,
      account.balance,
      account.manual ? 1 : 0,
      account.type,
      account.baseCurrency,
      account.baseBalance,
      account.errorDetails,
      account.errorRetries,
      account.accountReference,
      account.iban,
      account.subtype,
      account.bic,
      account.routingNumber,
      account.wireRoutingNumber,
      account.accountNumber,
      account.sortCode,
      account.availableBalance,
      account.creditLimit,
      account.bankConnection ? JSON.stringify(account.bankConnection) : null,
      new Date().toISOString(),
    )
    .run();
}

export async function upsertBankAccountsInD1(
  d1: CloudflareD1DatabaseBinding,
  accounts: BankAccountRecord[],
) {
  for (const account of accounts) {
    await upsertBankAccountInD1(d1, account);
  }
}

export async function createBankAccountInD1(
  d1: CloudflareD1DatabaseBinding,
  params: CreateBankAccountParams & { accountId: string },
) {
  const timestamp = new Date().toISOString();
  const account: BankAccountRecord = {
    id: crypto.randomUUID(),
    createdAt: timestamp,
    createdBy: params.userId,
    teamId: params.teamId,
    name: params.name,
    currency: params.currency ?? null,
    bankConnectionId: null,
    enabled: true,
    accountId: params.accountId,
    balance: null,
    manual: params.manual ?? false,
    type: "depository",
    baseCurrency: null,
    baseBalance: null,
    errorDetails: null,
    errorRetries: null,
    accountReference: null,
    iban: null,
    subtype: null,
    bic: null,
    routingNumber: null,
    wireRoutingNumber: null,
    accountNumber: null,
    sortCode: null,
    availableBalance: null,
    creditLimit: null,
    bankConnection: null,
  };

  await upsertBankAccountInD1(d1, account);

  return account;
}

export async function patchBankAccountInD1(
  d1: CloudflareD1DatabaseBinding,
  params: PatchBankAccountParams,
) {
  const existing = await getBankAccountByIdFromD1(d1, {
    id: params.id,
    teamId: params.teamId,
  });

  if (!existing) {
    return null;
  }

  const account: BankAccountRecord = {
    ...existing,
    name: params.name !== undefined ? params.name : existing.name,
    type: params.type !== undefined ? params.type : existing.type,
    balance: params.balance !== undefined ? params.balance : existing.balance,
    enabled: params.enabled !== undefined ? params.enabled : existing.enabled,
    currency: params.currency !== undefined ? params.currency : existing.currency,
    baseBalance: params.baseBalance !== undefined ? params.baseBalance : existing.baseBalance,
    baseCurrency: params.baseCurrency !== undefined ? params.baseCurrency : existing.baseCurrency,
    errorDetails: params.errorDetails !== undefined ? params.errorDetails : existing.errorDetails,
    errorRetries: params.errorRetries !== undefined ? params.errorRetries : existing.errorRetries,
    accountReference:
      params.accountReference !== undefined ? params.accountReference : existing.accountReference,
    accountId: params.accountId !== undefined ? params.accountId : existing.accountId,
    iban: params.iban !== undefined ? params.iban : existing.iban,
    subtype: params.subtype !== undefined ? params.subtype : existing.subtype,
    bic: params.bic !== undefined ? params.bic : existing.bic,
    routingNumber:
      params.routingNumber !== undefined ? params.routingNumber : existing.routingNumber,
    wireRoutingNumber:
      params.wireRoutingNumber !== undefined
        ? params.wireRoutingNumber
        : existing.wireRoutingNumber,
    accountNumber:
      params.accountNumber !== undefined ? params.accountNumber : existing.accountNumber,
    sortCode: params.sortCode !== undefined ? params.sortCode : existing.sortCode,
    availableBalance:
      params.availableBalance !== undefined ? params.availableBalance : existing.availableBalance,
    creditLimit: params.creditLimit !== undefined ? params.creditLimit : existing.creditLimit,
  };

  await upsertBankAccountInD1(d1, account);

  return account;
}

export async function getBankAccountsFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: BankAccountsD1Filter,
) {
  const filters = ["team_id = ?"];
  const values: unknown[] = [params.teamId];

  if (params.enabled !== undefined) {
    filters.push("enabled = ?");
    values.push(params.enabled ? 1 : 0);
  }

  if (params.manual !== undefined) {
    filters.push("manual = ?");
    values.push(params.manual ? 1 : 0);
  }

  const { results = [] } = await d1
    .prepare(
      `select * from bank_accounts
       where ${filters.join(" and ")}
       order by created_at asc, coalesce(name, '') desc`,
    )
    .bind(...values)
    .all<BankAccountRow>();

  return results.map(toBankAccountRecord);
}

export async function getBankAccountByIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { id: string; teamId: string },
) {
  const row = await d1
    .prepare("select * from bank_accounts where id = ? and team_id = ? limit 1")
    .bind(params.id, params.teamId)
    .first<BankAccountRow>();

  return row ? toBankAccountRecord(row) : null;
}

export async function getBankAccountTeamIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { id: string },
) {
  return d1
    .prepare("select team_id from bank_accounts where id = ? limit 1")
    .bind(params.id)
    .first<string>("team_id");
}

export async function getBankAccountsBalancesFromD1(
  d1: CloudflareD1DatabaseBinding,
  teamId: string,
) {
  const { results = [] } = await d1
    .prepare(
      `select
         id,
         coalesce(base_currency, currency, 'USD') as currency,
         coalesce(base_balance, balance, 0) as balance,
         coalesce(name, '') as name,
         coalesce(json_extract(bank_connection_json, '$.logoUrl'), '') as logo_url
       from bank_accounts
       where team_id = ? and enabled = 1
       order by name asc`,
    )
    .bind(teamId)
    .all<{
      id: string;
      currency: string;
      balance: number;
      name: string;
      logo_url: string;
    }>();

  return results;
}

export async function getBankAccountsCurrenciesFromD1(
  d1: CloudflareD1DatabaseBinding,
  teamId: string,
) {
  const { results = [] } = await d1
    .prepare(
      `select distinct currency
       from bank_accounts
       where team_id = ? and enabled = 1 and currency is not null
       order by currency asc`,
    )
    .bind(teamId)
    .all<{ currency: string }>();

  return results;
}

export async function deleteBankAccountFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { id: string; teamId: string },
) {
  await d1
    .prepare("delete from bank_accounts where id = ? and team_id = ?")
    .bind(params.id, params.teamId)
    .run();
}

export async function deleteBankAccountsForConnectionFromD1(
  db: Database,
  params: { connectionId: string; teamId: string },
) {
  const d1 = getBankAccountsD1(db);

  if (!d1) {
    return;
  }

  await d1
    .prepare("delete from bank_accounts where bank_connection_id = ? and team_id = ?")
    .bind(params.connectionId, params.teamId)
    .run();
}
