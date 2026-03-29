import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { nowIso } from "../../../packages/domain/src/identity";
import { getAppUserById, getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";

type BankConnectionCtx = QueryCtx | MutationCtx;

const bankConnectionProvider = v.union(
  v.literal("gocardless"),
  v.literal("teller"),
  v.literal("plaid"),
);

const bankConnectionStatus = v.union(
  v.literal("connected"),
  v.literal("disconnected"),
  v.literal("unknown"),
);

const bankAccountType = v.union(
  v.literal("depository"),
  v.literal("credit"),
  v.literal("other_asset"),
  v.literal("loan"),
  v.literal("other_liability"),
);

const providerAccount = v.object({
  id: v.optional(v.string()),
  accountId: v.string(),
  institutionId: v.optional(v.string()),
  logoUrl: v.optional(v.union(v.string(), v.null())),
  name: v.string(),
  bankName: v.optional(v.string()),
  currency: v.string(),
  enabled: v.optional(v.boolean()),
  balance: v.optional(v.number()),
  type: bankAccountType,
  accountReference: v.optional(v.union(v.string(), v.null())),
  expiresAt: v.optional(v.union(v.string(), v.null())),
  iban: v.optional(v.union(v.string(), v.null())),
  subtype: v.optional(v.union(v.string(), v.null())),
  bic: v.optional(v.union(v.string(), v.null())),
  routingNumber: v.optional(v.union(v.string(), v.null())),
  wireRoutingNumber: v.optional(v.union(v.string(), v.null())),
  accountNumber: v.optional(v.union(v.string(), v.null())),
  sortCode: v.optional(v.union(v.string(), v.null())),
  availableBalance: v.optional(v.union(v.number(), v.null())),
  creditLimit: v.optional(v.union(v.number(), v.null())),
});

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

function publicBankAccountId(
  account: Pick<Doc<"bankAccounts">, "_id" | "publicBankAccountId">,
) {
  return account.publicBankAccountId ?? account._id;
}

async function getTeamOrThrow(ctx: BankConnectionCtx, publicTeamId: string) {
  const team = await getTeamByPublicTeamId(ctx, publicTeamId);

  if (!team) {
    throw new ConvexError("Convex bank connection team not found");
  }

  return team;
}

async function getBankConnectionByPublicId(
  ctx: BankConnectionCtx,
  bankConnectionId: string,
) {
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

async function getBankConnectionsByTeamId(
  ctx: BankConnectionCtx,
  teamId: Id<"teams">,
) {
  return ctx.db
    .query("bankConnections")
    .withIndex("by_team_id", (q) => q.eq("teamId", teamId))
    .collect();
}

async function getBankAccountsByTeamId(
  ctx: BankConnectionCtx,
  teamId: Id<"teams">,
) {
  return ctx.db
    .query("bankAccounts")
    .withIndex("by_team_id", (q) => q.eq("teamId", teamId))
    .collect();
}

function serializeBankAccountListItem(
  account: Doc<"bankAccounts">,
  publicTeamId: string,
) {
  return {
    id: publicBankAccountId(account),
    createdAt: account.createdAt,
    createdBy: account.createdByAppUserId ?? null,
    teamId: publicTeamId,
    name: account.name ?? null,
    currency: account.currency ?? null,
    bankConnectionId: account.publicBankConnectionId ?? null,
    enabled: account.enabled,
    accountId: account.accountId,
    balance: account.balance ?? null,
    manual: account.manual,
    type: account.type ?? null,
    baseCurrency: account.baseCurrency ?? null,
    baseBalance: account.baseBalance ?? null,
    errorDetails: account.errorDetails ?? null,
    errorRetries: account.errorRetries ?? null,
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
  };
}

function serializeBankConnectionRecord(
  publicTeamId: string,
  connection: Doc<"bankConnections">,
  bankAccounts: Array<ReturnType<typeof serializeBankAccountListItem>>,
) {
  return {
    id: publicBankConnectionId(connection)!,
    createdAt: connection.createdAt,
    institutionId: connection.institutionId,
    expiresAt: connection.expiresAt ?? null,
    teamId: publicTeamId,
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
    bankAccounts,
  };
}

async function upsertConnectionAccount(
  ctx: MutationCtx,
  args: {
    teamId: Id<"teams">;
    appUserId?: Id<"appUsers">;
    connection: Doc<"bankConnections">;
    account: {
      id?: string;
      accountId: string;
      name: string;
      currency: string;
      enabled?: boolean;
      balance?: number;
      type: "depository" | "credit" | "other_asset" | "loan" | "other_liability";
      accountReference?: string | null;
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
  },
) {
  const connectionPublicId = publicBankConnectionId(args.connection);

  if (!connectionPublicId) {
    throw new ConvexError("Bank connection public id missing");
  }

  const byLegacyId = args.account.id
    ? await ctx.db
        .query("bankAccounts")
        .withIndex("by_public_bank_account_id", (q) =>
          q.eq("publicBankAccountId", args.account.id!),
        )
        .unique()
    : null;

  const existing =
    byLegacyId ??
    (await ctx.db
      .query("bankAccounts")
      .withIndex("by_team_and_account_id", (q) =>
        q.eq("teamId", args.teamId).eq("accountId", args.account.accountId),
      )
      .collect()).find(
        (account) => account.bankConnectionId === args.connection._id,
      ) ?? null;

  const payload = {
    teamId: args.teamId,
    createdByAppUserId: args.appUserId,
    bankConnectionId: args.connection._id,
    publicBankConnectionId: connectionPublicId,
    name: args.account.name,
    currency: args.account.currency,
    enabled: args.account.enabled ?? true,
    accountId: args.account.accountId,
    balance: args.account.balance ?? 0,
    manual: false,
    type: args.account.type,
    accountReference: args.account.accountReference ?? undefined,
    iban: args.account.iban ?? undefined,
    subtype: args.account.subtype ?? undefined,
    bic: args.account.bic ?? undefined,
    routingNumber: args.account.routingNumber ?? undefined,
    wireRoutingNumber: args.account.wireRoutingNumber ?? undefined,
    accountNumber: args.account.accountNumber ?? undefined,
    sortCode: args.account.sortCode ?? undefined,
    availableBalance: args.account.availableBalance ?? null,
    creditLimit: args.account.creditLimit ?? null,
    updatedAt: nowIso(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, {
      ...payload,
      publicBankAccountId: args.account.id ?? existing.publicBankAccountId,
    });
    return ctx.db.get(existing._id);
  }

  const createdId = await ctx.db.insert("bankAccounts", {
    publicBankAccountId: args.account.id ?? crypto.randomUUID(),
    createdAt: nowIso(),
    ...payload,
  });

  return ctx.db.get(createdId);
}

export const serviceGetBankConnections = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    enabled: v.optional(v.boolean()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const [connections, accounts] = await Promise.all([
      getBankConnectionsByTeamId(ctx, team._id),
      getBankAccountsByTeamId(ctx, team._id),
    ]);

    const accountsByConnectionId = new Map<string, Doc<"bankAccounts">[]>();

    for (const account of accounts) {
      if (!account.bankConnectionId) {
        continue;
      }

      const current = accountsByConnectionId.get(account.bankConnectionId) ?? [];
      if (args.enabled === undefined || account.enabled === args.enabled) {
        current.push(account);
      }
      accountsByConnectionId.set(account.bankConnectionId, current);
    }

    return connections.map((connection) =>
      serializeBankConnectionRecord(
        args.publicTeamId,
        connection,
        (accountsByConnectionId.get(connection._id) ?? []).map((account) =>
          serializeBankAccountListItem(account, args.publicTeamId),
        ),
      ),
    );
  },
});

export const serviceGetBankConnectionById = query({
  args: {
    serviceKey: v.string(),
    id: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const connection = await getBankConnectionByPublicId(ctx, args.id);

    if (!connection) {
      return null;
    }

    const team = await ctx.db.get(connection.teamId);
    const teamPublicId = publicTeamId(team);

    if (!teamPublicId) {
      return null;
    }

    const accounts = await getBankAccountsByTeamId(ctx, connection.teamId);

    return serializeBankConnectionRecord(
      teamPublicId,
      connection,
      accounts
        .filter((account) => account.bankConnectionId === connection._id)
        .map((account) => serializeBankAccountListItem(account, teamPublicId)),
    );
  },
});

export const serviceCreateBankConnection = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    userId: v.optional(v.id("appUsers")),
    id: v.optional(v.string()),
    provider: bankConnectionProvider,
    accounts: v.array(providerAccount),
    accessToken: v.optional(v.union(v.string(), v.null())),
    enrollmentId: v.optional(v.union(v.string(), v.null())),
    referenceId: v.optional(v.union(v.string(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const firstAccount = args.accounts.at(0);
    if (!firstAccount?.institutionId || !firstAccount.bankName) {
      return null;
    }

    const team = await getTeamOrThrow(ctx, args.publicTeamId);
    const appUser = args.userId
      ? await getAppUserById(ctx, args.userId)
      : null;
    const timestamp = nowIso();

    const existing = await ctx.db
      .query("bankConnections")
      .withIndex("by_team_and_institution_id", (q) =>
        q.eq("teamId", team._id).eq("institutionId", firstAccount.institutionId!),
      )
      .unique();

    let connection: Doc<"bankConnections"> | null = null;

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: firstAccount.bankName,
        logoUrl: firstAccount.logoUrl ?? undefined,
        accessToken: args.accessToken ?? undefined,
        enrollmentId: args.enrollmentId ?? undefined,
        referenceId: args.referenceId ?? undefined,
        expiresAt: firstAccount.expiresAt ?? undefined,
        lastAccessed: timestamp,
        provider: args.provider,
        updatedAt: timestamp,
      });
      connection = await ctx.db.get(existing._id);
    } else {
      const createdId = await ctx.db.insert("bankConnections", {
        publicBankConnectionId: args.id ?? crypto.randomUUID(),
        teamId: team._id,
        institutionId: firstAccount.institutionId,
        name: firstAccount.bankName,
        logoUrl: firstAccount.logoUrl ?? undefined,
        accessToken: args.accessToken ?? undefined,
        enrollmentId: args.enrollmentId ?? undefined,
        provider: args.provider,
        expiresAt: firstAccount.expiresAt ?? undefined,
        lastAccessed: timestamp,
        referenceId: args.referenceId ?? undefined,
        status: "connected",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      connection = await ctx.db.get(createdId);
    }

    if (!connection) {
      return null;
    }

    for (const account of args.accounts) {
      await upsertConnectionAccount(ctx, {
        teamId: team._id,
        appUserId: appUser?._id,
        connection,
        account: {
          id: account.id,
          accountId: account.accountId,
          name: account.name,
          currency: account.currency,
          enabled: account.enabled,
          balance: account.balance,
          type: account.type,
          accountReference: account.accountReference,
          iban: account.iban,
          subtype: account.subtype,
          bic: account.bic,
          routingNumber: account.routingNumber,
          wireRoutingNumber: account.wireRoutingNumber,
          accountNumber: account.accountNumber,
          sortCode: account.sortCode,
          availableBalance: account.availableBalance,
          creditLimit: account.creditLimit,
        },
      });
    }

    const accounts = await ctx.db
      .query("bankAccounts")
      .withIndex("by_team_and_bank_connection", (q) =>
        q.eq("teamId", team._id).eq("bankConnectionId", connection._id),
      )
      .collect();

    return serializeBankConnectionRecord(
      args.publicTeamId,
      connection,
      accounts.map((account) =>
        serializeBankAccountListItem(account, args.publicTeamId),
      ),
    );
  },
});

export const serviceDeleteBankConnection = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    bankConnectionId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const connection = await getBankConnectionByPublicId(ctx, args.bankConnectionId);

    if (!connection || connection.teamId !== team._id) {
      return null;
    }

    const accounts = await ctx.db
      .query("bankAccounts")
      .withIndex("by_team_and_bank_connection", (q) =>
        q.eq("teamId", team._id).eq("bankConnectionId", connection._id),
      )
      .collect();

    for (const account of accounts) {
      await ctx.db.delete(account._id);
    }

    await ctx.db.delete(connection._id);

    return {
      referenceId: connection.referenceId ?? null,
      provider: connection.provider,
      accessToken: connection.accessToken ?? null,
    };
  },
});

export const serviceAddProviderAccounts = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    userId: v.optional(v.id("appUsers")),
    bankConnectionId: v.string(),
    accounts: v.array(providerAccount),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.accounts.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);
    const appUser = args.userId
      ? await getAppUserById(ctx, args.userId)
      : null;

    if (!team) {
      return [];
    }

    const connection = await getBankConnectionByPublicId(ctx, args.bankConnectionId);

    if (!connection || connection.teamId !== team._id) {
      return [];
    }

    const inserted: ReturnType<typeof serializeBankAccountListItem>[] = [];

    for (const account of args.accounts) {
      const existing = await ctx.db
        .query("bankAccounts")
        .withIndex("by_team_and_account_id", (q) =>
          q.eq("teamId", team._id).eq("accountId", account.accountId),
        )
        .collect()
        .then((accounts) =>
          accounts.find(
            (candidate) => candidate.bankConnectionId === connection._id,
          ),
        );

      if (existing) {
        continue;
      }

      const created = await upsertConnectionAccount(ctx, {
        teamId: team._id,
        appUserId: appUser?._id,
        connection,
        account: {
          id: account.id,
          accountId: account.accountId,
          name: account.name,
          currency: account.currency,
          enabled: account.enabled ?? true,
          balance: account.balance,
          type: account.type,
          accountReference: account.accountReference,
          iban: account.iban,
          subtype: account.subtype,
          bic: account.bic,
          routingNumber: account.routingNumber,
          wireRoutingNumber: account.wireRoutingNumber,
          accountNumber: account.accountNumber,
          sortCode: account.sortCode,
          availableBalance: account.availableBalance,
          creditLimit: account.creditLimit,
        },
      });

      if (created) {
        inserted.push(
          serializeBankAccountListItem(created, args.publicTeamId),
        );
      }
    }

    return inserted;
  },
});

export const serviceReconnectBankConnection = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    referenceId: v.string(),
    newReferenceId: v.string(),
    expiresAt: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const connection = await ctx.db
      .query("bankConnections")
      .withIndex("by_team_and_reference_id", (q) =>
        q.eq("teamId", team._id).eq("referenceId", args.referenceId),
      )
      .unique();

    if (!connection) {
      return null;
    }

    await ctx.db.patch(connection._id, {
      referenceId: args.newReferenceId,
      expiresAt: args.expiresAt,
      status: "connected",
      updatedAt: nowIso(),
    });

    return {
      id: publicBankConnectionId(connection),
    };
  },
});

export const serviceGetBankConnectionByEnrollmentId = query({
  args: {
    serviceKey: v.string(),
    enrollmentId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const connection = await ctx.db
      .query("bankConnections")
      .withIndex("by_enrollment_id", (q) => q.eq("enrollmentId", args.enrollmentId))
      .unique();

    if (!connection) {
      return null;
    }

    const team = await ctx.db.get(connection.teamId);

    if (!team) {
      return null;
    }

    return {
      id: publicBankConnectionId(connection),
      createdAt: connection.createdAt,
      team: {
        id: publicTeamId(team)!,
        plan: team.plan ?? "trial",
        createdAt: team.createdAt,
      },
    };
  },
});

export const serviceGetBankConnectionByReferenceId = query({
  args: {
    serviceKey: v.string(),
    referenceId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const connection = await ctx.db
      .query("bankConnections")
      .withIndex("by_reference_id", (q) => q.eq("referenceId", args.referenceId))
      .unique();

    if (!connection) {
      return null;
    }

    const team = await ctx.db.get(connection.teamId);

    if (!team) {
      return null;
    }

    return {
      id: publicBankConnectionId(connection),
      createdAt: connection.createdAt,
      team: {
        id: publicTeamId(team)!,
        plan: team.plan ?? "trial",
        createdAt: team.createdAt,
      },
    };
  },
});

export const serviceUpdateBankConnectionStatus = mutation({
  args: {
    serviceKey: v.string(),
    bankConnectionId: v.string(),
    status: bankConnectionStatus,
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const connection = await getBankConnectionByPublicId(ctx, args.bankConnectionId);

    if (!connection) {
      return null;
    }

    await ctx.db.patch(connection._id, {
      status: args.status,
      updatedAt: nowIso(),
    });

    return {
      id: publicBankConnectionId(connection),
    };
  },
});

export const serviceUpdateBankConnectionReconnectById = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    bankConnectionId: v.string(),
    referenceId: v.optional(v.string()),
    accessValidForDays: v.number(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const connection = await getBankConnectionByPublicId(ctx, args.bankConnectionId);

    if (!connection || connection.teamId !== team._id) {
      return null;
    }

    const expiresAt = new Date(
      Date.now() + args.accessValidForDays * 24 * 60 * 60 * 1000,
    ).toDateString();

    await ctx.db.patch(connection._id, {
      expiresAt,
      referenceId: args.referenceId ?? undefined,
      updatedAt: nowIso(),
    });

    return {
      id: publicBankConnectionId(connection),
    };
  },
});

export const servicePatchBankConnection = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.optional(v.string()),
    bankConnectionId: v.string(),
    institutionId: v.optional(v.string()),
    expiresAt: v.optional(v.union(v.string(), v.null())),
    name: v.optional(v.string()),
    logoUrl: v.optional(v.union(v.string(), v.null())),
    accessToken: v.optional(v.union(v.string(), v.null())),
    enrollmentId: v.optional(v.union(v.string(), v.null())),
    provider: v.optional(bankConnectionProvider),
    lastAccessed: v.optional(v.union(v.string(), v.null())),
    referenceId: v.optional(v.union(v.string(), v.null())),
    status: v.optional(bankConnectionStatus),
    errorDetails: v.optional(v.union(v.string(), v.null())),
    errorRetries: v.optional(v.union(v.number(), v.null())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const connection = await getBankConnectionByPublicId(ctx, args.bankConnectionId);

    if (!connection) {
      return null;
    }

    if (args.publicTeamId) {
      const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);
      if (!team || connection.teamId !== team._id) {
        return null;
      }
    }

    const patch: {
      institutionId?: string;
      expiresAt?: string;
      name?: string;
      logoUrl?: string;
      accessToken?: string;
      enrollmentId?: string;
      provider?: "gocardless" | "teller" | "plaid";
      lastAccessed?: string;
      referenceId?: string;
      status?: "connected" | "disconnected" | "unknown";
      errorDetails?: string;
      errorRetries?: number;
      updatedAt: string;
    } = {
      updatedAt: nowIso(),
    };

    if (args.institutionId !== undefined) {
      patch.institutionId = args.institutionId;
    }
    if (args.expiresAt !== undefined) {
      patch.expiresAt = args.expiresAt ?? undefined;
    }
    if (args.name !== undefined) {
      patch.name = args.name;
    }
    if (args.logoUrl !== undefined) {
      patch.logoUrl = args.logoUrl ?? undefined;
    }
    if (args.accessToken !== undefined) {
      patch.accessToken = args.accessToken ?? undefined;
    }
    if (args.enrollmentId !== undefined) {
      patch.enrollmentId = args.enrollmentId ?? undefined;
    }
    if (args.provider !== undefined) {
      patch.provider = args.provider;
    }
    if (args.lastAccessed !== undefined) {
      patch.lastAccessed = args.lastAccessed ?? undefined;
    }
    if (args.referenceId !== undefined) {
      patch.referenceId = args.referenceId ?? undefined;
    }
    if (args.status !== undefined) {
      patch.status = args.status;
    }
    if (args.errorDetails !== undefined) {
      patch.errorDetails = args.errorDetails ?? undefined;
    }
    if (args.errorRetries !== undefined) {
      patch.errorRetries = args.errorRetries ?? undefined;
    }

    await ctx.db.patch(connection._id, patch);
    const updated = await ctx.db.get(connection._id);

    if (!updated) {
      return null;
    }

    const accounts = await ctx.db
      .query("bankAccounts")
      .withIndex("by_team_and_bank_connection", (q) =>
        q.eq("teamId", updated.teamId).eq("bankConnectionId", updated._id),
      )
      .collect();
    const team = await ctx.db.get(updated.teamId);
    const teamPublicId = publicTeamId(team);

    if (!teamPublicId) {
      return null;
    }

    return serializeBankConnectionRecord(
      teamPublicId,
      updated,
      accounts.map((account) => serializeBankAccountListItem(account, teamPublicId)),
    );
  },
});
