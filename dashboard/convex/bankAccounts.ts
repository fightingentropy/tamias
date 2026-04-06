import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { nowIso } from "../../packages/domain/src/identity";
import { getAppUserById, getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";

type BankAccountCtx = QueryCtx | MutationCtx;

const bankAccountType = v.union(
  v.literal("depository"),
  v.literal("credit"),
  v.literal("other_asset"),
  v.literal("loan"),
  v.literal("other_liability"),
);

function publicTeamId(team: Doc<"teams"> | null) {
  if (!team) {
    return null;
  }

  return team.publicTeamId ?? team._id;
}

function publicBankConnectionId(
  connection: Pick<Doc<"bankConnections">, "_id" | "publicBankConnectionId"> | null,
) {
  if (!connection) {
    return null;
  }

  return connection.publicBankConnectionId ?? connection._id;
}

function publicBankAccountId(account: Pick<Doc<"bankAccounts">, "_id" | "publicBankAccountId">) {
  return account.publicBankAccountId ?? account._id;
}

async function getTeamOrThrow(ctx: BankAccountCtx, publicTeamId: string) {
  const team = await getTeamByPublicTeamId(ctx, publicTeamId);

  if (!team) {
    throw new ConvexError("Convex bank account team not found");
  }

  return team;
}

async function getBankConnectionByPublicId(ctx: BankAccountCtx, bankConnectionId: string) {
  const byLegacyId = await ctx.db
    .query("bankConnections")
    .withIndex("by_public_bank_connection_id", (q) =>
      q.eq("publicBankConnectionId", bankConnectionId),
    )
    .unique();

  if (byLegacyId) {
    return byLegacyId;
  }

  return ctx.db.get(bankConnectionId as Id<"bankConnections">);
}

async function getBankAccountByPublicId(
  ctx: BankAccountCtx,
  args: {
    accountId: string;
    teamId: Id<"teams">;
  },
) {
  const byLegacyId = await ctx.db
    .query("bankAccounts")
    .withIndex("by_public_bank_account_id", (q) => q.eq("publicBankAccountId", args.accountId))
    .unique();

  if (byLegacyId && byLegacyId.teamId === args.teamId) {
    return byLegacyId;
  }

  const byDocId = await ctx.db.get(args.accountId as Id<"bankAccounts">);

  if (byDocId && byDocId.teamId === args.teamId) {
    return byDocId;
  }

  return null;
}

async function serializeBankAccount(
  ctx: BankAccountCtx,
  args: {
    account: Doc<"bankAccounts">;
    publicTeamId: string;
    includeBankConnection?: boolean;
  },
) {
  const connection = args.account.bankConnectionId
    ? await ctx.db.get(args.account.bankConnectionId)
    : null;

  const bankConnection =
    args.includeBankConnection && connection
      ? {
          id: publicBankConnectionId(connection),
          createdAt: connection.createdAt,
          institutionId: connection.institutionId,
          expiresAt: connection.expiresAt ?? null,
          teamId: args.publicTeamId,
          name: connection.name,
          logoUrl: connection.logoUrl ?? null,
          accessToken: connection.accessToken ?? null,
          enrollmentId: connection.enrollmentId ?? null,
          provider: connection.provider,
          lastAccessed: connection.lastAccessed ?? null,
          referenceId: connection.referenceId ?? null,
          status: connection.status,
          errorDetails: connection.errorDetails ?? null,
          errorRetries: connection.errorRetries ?? null,
        }
      : null;

  return {
    id: publicBankAccountId(args.account),
    createdAt: args.account.createdAt,
    createdBy: args.account.createdByAppUserId ?? null,
    teamId: args.publicTeamId,
    name: args.account.name ?? null,
    currency: args.account.currency ?? null,
    bankConnectionId:
      args.account.publicBankConnectionId ??
      (connection ? publicBankConnectionId(connection) : null) ??
      null,
    enabled: args.account.enabled,
    accountId: args.account.accountId,
    balance: args.account.balance ?? null,
    manual: args.account.manual,
    type: args.account.type ?? null,
    baseCurrency: args.account.baseCurrency ?? null,
    baseBalance: args.account.baseBalance ?? null,
    errorDetails: args.account.errorDetails ?? null,
    errorRetries: args.account.errorRetries ?? null,
    accountReference: args.account.accountReference ?? null,
    iban: args.account.iban ?? null,
    subtype: args.account.subtype ?? null,
    bic: args.account.bic ?? null,
    routingNumber: args.account.routingNumber ?? null,
    wireRoutingNumber: args.account.wireRoutingNumber ?? null,
    accountNumber: args.account.accountNumber ?? null,
    sortCode: args.account.sortCode ?? null,
    availableBalance: args.account.availableBalance ?? null,
    creditLimit: args.account.creditLimit ?? null,
    bankConnection,
  };
}

export const serviceGetBankAccounts = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    enabled: v.optional(v.boolean()),
    manual: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const accounts = await ctx.db
      .query("bankAccounts")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    const filtered = accounts
      .filter((account) => (args.enabled === undefined ? true : account.enabled === args.enabled))
      .filter((account) => (args.manual === undefined ? true : account.manual === args.manual))
      .sort((left, right) => {
        const createdAtDiff = left.createdAt.localeCompare(right.createdAt);

        if (createdAtDiff !== 0) {
          return createdAtDiff;
        }

        return (right.name ?? "").localeCompare(left.name ?? "");
      });

    return Promise.all(
      filtered.map((account) =>
        serializeBankAccount(ctx, {
          account,
          publicTeamId: args.publicTeamId,
          includeBankConnection: true,
        }),
      ),
    );
  },
});

export const serviceGetBankAccountById = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    id: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const account = await getBankAccountByPublicId(ctx, {
      accountId: args.id,
      teamId: team._id,
    });

    if (!account) {
      return null;
    }

    return serializeBankAccount(ctx, {
      account,
      publicTeamId: args.publicTeamId,
      includeBankConnection: true,
    });
  },
});

export const serviceGetBankAccountTeamId = query({
  args: {
    serviceKey: v.string(),
    id: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const byLegacyId = await ctx.db
      .query("bankAccounts")
      .withIndex("by_public_bank_account_id", (q) => q.eq("publicBankAccountId", args.id))
      .unique();

    const account = byLegacyId ?? (await ctx.db.get(args.id as Id<"bankAccounts">));

    if (!account) {
      return null;
    }

    const team = await ctx.db.get(account.teamId);
    return publicTeamId(team);
  },
});

export const serviceGetBankAccountsBalances = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const accounts = await ctx.db
      .query("bankAccounts")
      .withIndex("by_team_enabled", (q) => q.eq("teamId", team._id).eq("enabled", true))
      .collect();

    const connections = await Promise.all(
      accounts.map((account) =>
        account.bankConnectionId ? ctx.db.get(account.bankConnectionId) : null,
      ),
    );

    return accounts
      .map((account, index) => {
        const connection = connections[index];

        return {
          id: publicBankAccountId(account),
          currency: account.baseCurrency ?? account.currency ?? "USD",
          balance: account.baseBalance ?? account.balance ?? 0,
          name: account.name ?? "",
          logo_url: connection?.logoUrl ?? "",
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  },
});

export const serviceGetBankAccountsCurrencies = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const accounts = await ctx.db
      .query("bankAccounts")
      .withIndex("by_team_enabled", (q) => q.eq("teamId", team._id).eq("enabled", true))
      .collect();

    return [...new Set(accounts.map((account) => account.currency).filter(Boolean))]
      .sort((left, right) => left!.localeCompare(right!))
      .map((currency) => ({
        currency: currency!,
      }));
  },
});

export const serviceCreateBankAccount = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    userId: v.optional(v.id("appUsers")),
    id: v.optional(v.string()),
    name: v.string(),
    currency: v.optional(v.string()),
    manual: v.optional(v.boolean()),
    accountId: v.optional(v.string()),
    type: v.optional(bankAccountType),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.publicTeamId);
    const appUser = args.userId ? await getAppUserById(ctx, args.userId) : null;
    const timestamp = nowIso();

    const insertedId = await ctx.db.insert("bankAccounts", {
      publicBankAccountId: args.id ?? crypto.randomUUID(),
      teamId: team._id,
      createdByAppUserId: appUser?._id,
      name: args.name,
      currency: args.currency,
      enabled: true,
      accountId: args.accountId ?? crypto.randomUUID(),
      balance: 0,
      manual: args.manual ?? false,
      type: args.type ?? "depository",
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create bank account");
    }

    return serializeBankAccount(ctx, {
      account: inserted,
      publicTeamId: args.publicTeamId,
      includeBankConnection: true,
    });
  },
});

export const serviceUpdateBankAccount = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    bankAccountId: v.string(),
    name: v.optional(v.string()),
    type: v.optional(bankAccountType),
    balance: v.optional(v.union(v.number(), v.null())),
    enabled: v.optional(v.boolean()),
    currency: v.optional(v.string()),
    baseBalance: v.optional(v.union(v.number(), v.null())),
    baseCurrency: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const account = await getBankAccountByPublicId(ctx, {
      accountId: args.bankAccountId,
      teamId: team._id,
    });

    if (!account) {
      return null;
    }

    const patch: {
      name?: string;
      type?: "depository" | "credit" | "other_asset" | "loan" | "other_liability";
      balance?: number | null;
      enabled?: boolean;
      currency?: string;
      baseBalance?: number | null;
      baseCurrency?: string;
      updatedAt: string;
    } = {
      updatedAt: nowIso(),
    };

    if (args.name !== undefined) {
      patch.name = args.name;
    }

    if (args.type !== undefined) {
      patch.type = args.type;
    }

    if (args.balance !== undefined) {
      patch.balance = args.balance;
    }

    if (args.enabled !== undefined) {
      patch.enabled = args.enabled;
    }

    if (args.currency !== undefined) {
      patch.currency = args.currency;
    }

    if (args.baseBalance !== undefined) {
      patch.baseBalance = args.baseBalance;
    }

    if (args.baseCurrency !== undefined) {
      patch.baseCurrency = args.baseCurrency;
    }

    await ctx.db.patch(account._id, patch);

    const updated = await ctx.db.get(account._id);

    if (!updated) {
      return null;
    }

    return serializeBankAccount(ctx, {
      account: updated,
      publicTeamId: args.publicTeamId,
      includeBankConnection: true,
    });
  },
});

export const servicePatchBankAccountByLegacyId = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    bankAccountId: v.string(),
    balance: v.optional(v.union(v.number(), v.null())),
    availableBalance: v.optional(v.union(v.number(), v.null())),
    creditLimit: v.optional(v.union(v.number(), v.null())),
    errorDetails: v.optional(v.union(v.string(), v.null())),
    errorRetries: v.optional(v.union(v.number(), v.null())),
    currency: v.optional(v.string()),
    accountId: v.optional(v.string()),
    accountReference: v.optional(v.union(v.string(), v.null())),
    iban: v.optional(v.union(v.string(), v.null())),
    bankConnectionId: v.optional(v.string()),
    bankConnectionDocId: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
    baseBalance: v.optional(v.union(v.number(), v.null())),
    baseCurrency: v.optional(v.union(v.string(), v.null())),
    name: v.optional(v.union(v.string(), v.null())),
    type: v.optional(v.union(bankAccountType, v.null())),
    subtype: v.optional(v.union(v.string(), v.null())),
    bic: v.optional(v.union(v.string(), v.null())),
    routingNumber: v.optional(v.union(v.string(), v.null())),
    wireRoutingNumber: v.optional(v.union(v.string(), v.null())),
    accountNumber: v.optional(v.union(v.string(), v.null())),
    sortCode: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const account = await getBankAccountByPublicId(ctx, {
      accountId: args.bankAccountId,
      teamId: team._id,
    });

    if (!account) {
      return null;
    }

    let connectionDocId: Id<"bankConnections"> | undefined;
    let bankConnectionPublicId: string | undefined;

    if (args.bankConnectionDocId !== undefined) {
      connectionDocId = args.bankConnectionDocId
        ? (args.bankConnectionDocId as Id<"bankConnections">)
        : undefined;
      bankConnectionPublicId = undefined;
    } else if (args.bankConnectionId !== undefined) {
      if (args.bankConnectionId) {
        const connection = await getBankConnectionByPublicId(ctx, args.bankConnectionId);

        connectionDocId = connection?._id;
        bankConnectionPublicId =
          (connection ? publicBankConnectionId(connection) : null) ?? args.bankConnectionId;
      } else {
        connectionDocId = undefined;
        bankConnectionPublicId = undefined;
      }
    }

    const patch: {
      balance?: number | null;
      availableBalance?: number | null;
      creditLimit?: number | null;
      errorDetails?: string;
      errorRetries?: number | null;
      currency?: string;
      accountId?: string;
      accountReference?: string;
      iban?: string;
      bankConnectionId?: Id<"bankConnections">;
      publicBankConnectionId?: string;
      enabled?: boolean;
      baseBalance?: number | null;
      baseCurrency?: string;
      name?: string;
      type?: "depository" | "credit" | "other_asset" | "loan" | "other_liability";
      subtype?: string;
      bic?: string;
      routingNumber?: string;
      wireRoutingNumber?: string;
      accountNumber?: string;
      sortCode?: string;
      updatedAt: string;
    } = {
      updatedAt: nowIso(),
    };

    if (args.balance !== undefined) {
      patch.balance = args.balance;
    }

    if (args.availableBalance !== undefined) {
      patch.availableBalance = args.availableBalance;
    }

    if (args.creditLimit !== undefined) {
      patch.creditLimit = args.creditLimit;
    }

    if (args.errorDetails !== undefined) {
      patch.errorDetails = args.errorDetails ?? undefined;
    }

    if (args.errorRetries !== undefined) {
      patch.errorRetries = args.errorRetries;
    }

    if (args.currency !== undefined) {
      patch.currency = args.currency;
    }

    if (args.accountId !== undefined) {
      patch.accountId = args.accountId;
    }

    if (args.accountReference !== undefined) {
      patch.accountReference = args.accountReference ?? undefined;
    }

    if (args.iban !== undefined) {
      patch.iban = args.iban ?? undefined;
    }

    if (args.bankConnectionDocId !== undefined || args.bankConnectionId !== undefined) {
      patch.bankConnectionId = connectionDocId;
      patch.publicBankConnectionId = bankConnectionPublicId;
    }

    if (args.enabled !== undefined) {
      patch.enabled = args.enabled;
    }

    if (args.baseBalance !== undefined) {
      patch.baseBalance = args.baseBalance;
    }

    if (args.baseCurrency !== undefined) {
      patch.baseCurrency = args.baseCurrency ?? undefined;
    }

    if (args.name !== undefined) {
      patch.name = args.name ?? undefined;
    }

    if (args.type !== undefined) {
      patch.type = args.type ?? undefined;
    }

    if (args.subtype !== undefined) {
      patch.subtype = args.subtype ?? undefined;
    }

    if (args.bic !== undefined) {
      patch.bic = args.bic ?? undefined;
    }

    if (args.routingNumber !== undefined) {
      patch.routingNumber = args.routingNumber ?? undefined;
    }

    if (args.wireRoutingNumber !== undefined) {
      patch.wireRoutingNumber = args.wireRoutingNumber ?? undefined;
    }

    if (args.accountNumber !== undefined) {
      patch.accountNumber = args.accountNumber ?? undefined;
    }

    if (args.sortCode !== undefined) {
      patch.sortCode = args.sortCode ?? undefined;
    }

    await ctx.db.patch(account._id, patch);

    const updated = await ctx.db.get(account._id);

    if (!updated) {
      return null;
    }

    return serializeBankAccount(ctx, {
      account: updated,
      publicTeamId: args.publicTeamId,
      includeBankConnection: true,
    });
  },
});

export const serviceDeleteBankAccount = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    bankAccountId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const account = await getBankAccountByPublicId(ctx, {
      accountId: args.bankAccountId,
      teamId: team._id,
    });

    if (!account) {
      return null;
    }

    const serialized = await serializeBankAccount(ctx, {
      account,
      publicTeamId: args.publicTeamId,
      includeBankConnection: true,
    });

    await ctx.db.delete(account._id);
    return serialized;
  },
});

export const serviceGetBankAccountDetails = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    accountId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const account = await getBankAccountByPublicId(ctx, {
      accountId: args.accountId,
      teamId: team._id,
    });

    if (!account) {
      return null;
    }

    return {
      id: publicBankAccountId(account),
      iban: account.iban ?? null,
      accountNumber: account.accountNumber ?? null,
      routingNumber: account.routingNumber ?? null,
      wireRoutingNumber: account.wireRoutingNumber ?? null,
      bic: account.bic ?? null,
      sortCode: account.sortCode ?? null,
    };
  },
});

export const serviceGetBankAccountsWithPaymentInfo = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const accounts = await ctx.db
      .query("bankAccounts")
      .withIndex("by_team_enabled", (q) => q.eq("teamId", team._id).eq("enabled", true))
      .collect();

    const withPaymentInfo = accounts.filter((account) => {
      const hasIban = !!account.iban;
      const hasUsPaymentInfo = !!(account.routingNumber && account.accountNumber);
      const hasUkPaymentInfo = !!(account.sortCode && account.accountNumber);
      return hasIban || hasUsPaymentInfo || hasUkPaymentInfo;
    });

    const connectionById = new Map<string, string | null>();

    for (const account of withPaymentInfo) {
      if (!account.bankConnectionId || connectionById.has(account.bankConnectionId)) {
        continue;
      }

      const connection = await ctx.db.get(account.bankConnectionId);
      connectionById.set(account.bankConnectionId, connection?.name ?? null);
    }

    return withPaymentInfo.map((account) => ({
      id: publicBankAccountId(account),
      name: account.name ?? "Unknown Account",
      bankName: account.bankConnectionId
        ? (connectionById.get(account.bankConnectionId) ?? null)
        : null,
      currency: account.currency ?? null,
      iban: account.iban ?? null,
      accountNumber: account.accountNumber ?? null,
      routingNumber: account.routingNumber ?? null,
      wireRoutingNumber: account.wireRoutingNumber ?? null,
      bic: account.bic ?? null,
      sortCode: account.sortCode ?? null,
    }));
  },
});
