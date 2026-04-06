import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  normalizeEmail,
  normalizeOptionalString,
  nowIso,
} from "../../packages/domain/src/identity";
import { buildSearchIndexText, buildSearchQuery } from "../../packages/domain/src/text-search";
import { getTeamByPublicTeamId, publicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";

type CustomerCtx = QueryCtx | MutationCtx;

const nullableString = v.optional(v.union(v.string(), v.null()));
const nullableNumber = v.optional(v.union(v.number(), v.null()));
const nullableBoolean = v.optional(v.union(v.boolean(), v.null()));
const customerOrderValidator = v.union(v.literal("asc"), v.literal("desc"));

function publicCustomerId(
  customer: Pick<Doc<"customers">, "_id" | "publicCustomerId"> | null | undefined,
) {
  if (!customer) {
    return null;
  }

  return customer.publicCustomerId ?? customer._id;
}

async function getTeamOrThrow(ctx: CustomerCtx, teamId: string) {
  const team = await getTeamByPublicTeamId(ctx, teamId);

  if (!team) {
    throw new ConvexError("Convex customer team not found");
  }

  return team;
}

async function getCustomerByPublicId(
  ctx: CustomerCtx,
  args: {
    customerId: string;
    teamId?: Id<"teams">;
  },
) {
  const byLegacyId = await ctx.db
    .query("customers")
    .withIndex("by_public_customer_id", (q) =>
      q.eq("publicCustomerId", args.customerId),
    )
    .unique();

  if (byLegacyId && (!args.teamId || byLegacyId.teamId === args.teamId)) {
    return byLegacyId;
  }

  try {
    const byDocId = await ctx.db.get(args.customerId as Id<"customers">);

    if (byDocId && (!args.teamId || byDocId.teamId === args.teamId)) {
      return byDocId;
    }
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("db.get") ||
      !error.message.includes("Unable to decode ID")
    ) {
      throw error;
    }
  }

  return null;
}

function serializeCustomer(customer: Doc<"customers">, teamId: string) {
  return {
    id: publicCustomerId(customer)!,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    teamId,
    name: customer.name,
    email: customer.email,
    billingEmail: customer.billingEmail ?? null,
    country: customer.country ?? null,
    addressLine1: customer.addressLine1 ?? null,
    addressLine2: customer.addressLine2 ?? null,
    city: customer.city ?? null,
    state: customer.state ?? null,
    zip: customer.zip ?? null,
    note: customer.note ?? null,
    website: customer.website ?? null,
    phone: customer.phone ?? null,
    vatNumber: customer.vatNumber ?? null,
    countryCode: customer.countryCode ?? null,
    token: customer.token ?? null,
    contact: customer.contact ?? null,
    status: customer.status ?? null,
    preferredCurrency: customer.preferredCurrency ?? null,
    defaultPaymentTerms: customer.defaultPaymentTerms ?? null,
    isArchived: customer.isArchived ?? false,
    source: customer.source ?? null,
    externalId: customer.externalId ?? null,
    logoUrl: customer.logoUrl ?? null,
    description: customer.description ?? null,
    industry: customer.industry ?? null,
    companyType: customer.companyType ?? null,
    employeeCount: customer.employeeCount ?? null,
    foundedYear: customer.foundedYear ?? null,
    estimatedRevenue: customer.estimatedRevenue ?? null,
    fundingStage: customer.fundingStage ?? null,
    totalFunding: customer.totalFunding ?? null,
    headquartersLocation: customer.headquartersLocation ?? null,
    timezone: customer.timezone ?? null,
    linkedinUrl: customer.linkedinUrl ?? null,
    twitterUrl: customer.twitterUrl ?? null,
    instagramUrl: customer.instagramUrl ?? null,
    facebookUrl: customer.facebookUrl ?? null,
    ceoName: customer.ceoName ?? null,
    financeContact: customer.financeContact ?? null,
    financeContactEmail: customer.financeContactEmail ?? null,
    primaryLanguage: customer.primaryLanguage ?? null,
    fiscalYearEnd: customer.fiscalYearEnd ?? null,
    enrichmentStatus: customer.enrichmentStatus ?? null,
    enrichedAt: customer.enrichedAt ?? null,
    portalEnabled: customer.portalEnabled ?? false,
    portalId: customer.portalId ?? null,
  };
}

function normalizeCustomerValues(
  args: {
    createdAt?: string | null;
    name: string;
    email: string;
    billingEmail?: string | null;
    country?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    note?: string | null;
    website?: string | null;
    phone?: string | null;
    vatNumber?: string | null;
    countryCode?: string | null;
    token?: string | null;
    contact?: string | null;
    status?: string | null;
    preferredCurrency?: string | null;
    defaultPaymentTerms?: number | null;
    isArchived?: boolean | null;
    source?: string | null;
    externalId?: string | null;
    logoUrl?: string | null;
    description?: string | null;
    industry?: string | null;
    companyType?: string | null;
    employeeCount?: string | null;
    foundedYear?: number | null;
    estimatedRevenue?: string | null;
    fundingStage?: string | null;
    totalFunding?: string | null;
    headquartersLocation?: string | null;
    timezone?: string | null;
    linkedinUrl?: string | null;
    twitterUrl?: string | null;
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    ceoName?: string | null;
    financeContact?: string | null;
    financeContactEmail?: string | null;
    primaryLanguage?: string | null;
    fiscalYearEnd?: string | null;
    enrichmentStatus?: string | null;
    enrichedAt?: string | null;
    portalEnabled?: boolean | null;
    portalId?: string | null;
  },
) {
  return {
    createdAt: args.createdAt ?? undefined,
    name: args.name.trim(),
    email: normalizeEmail(args.email) ?? args.email.trim().toLowerCase(),
    billingEmail: normalizeEmail(args.billingEmail) ?? undefined,
    country: normalizeOptionalString(args.country) ?? undefined,
    addressLine1: normalizeOptionalString(args.addressLine1) ?? undefined,
    addressLine2: normalizeOptionalString(args.addressLine2) ?? undefined,
    city: normalizeOptionalString(args.city) ?? undefined,
    state: normalizeOptionalString(args.state) ?? undefined,
    zip: normalizeOptionalString(args.zip) ?? undefined,
    note: normalizeOptionalString(args.note) ?? undefined,
    website: normalizeOptionalString(args.website) ?? undefined,
    phone: normalizeOptionalString(args.phone) ?? undefined,
    vatNumber: normalizeOptionalString(args.vatNumber) ?? undefined,
    countryCode: normalizeOptionalString(args.countryCode) ?? undefined,
    token: normalizeOptionalString(args.token) ?? undefined,
    contact: normalizeOptionalString(args.contact) ?? undefined,
    status: normalizeOptionalString(args.status) ?? undefined,
    preferredCurrency:
      normalizeOptionalString(args.preferredCurrency) ?? undefined,
    defaultPaymentTerms: args.defaultPaymentTerms ?? undefined,
    isArchived: args.isArchived ?? undefined,
    source: normalizeOptionalString(args.source) ?? undefined,
    externalId: normalizeOptionalString(args.externalId) ?? undefined,
    logoUrl: normalizeOptionalString(args.logoUrl) ?? undefined,
    description: normalizeOptionalString(args.description) ?? undefined,
    industry: normalizeOptionalString(args.industry) ?? undefined,
    companyType: normalizeOptionalString(args.companyType) ?? undefined,
    employeeCount: normalizeOptionalString(args.employeeCount) ?? undefined,
    foundedYear: args.foundedYear ?? undefined,
    estimatedRevenue:
      normalizeOptionalString(args.estimatedRevenue) ?? undefined,
    fundingStage: normalizeOptionalString(args.fundingStage) ?? undefined,
    totalFunding: normalizeOptionalString(args.totalFunding) ?? undefined,
    headquartersLocation:
      normalizeOptionalString(args.headquartersLocation) ?? undefined,
    timezone: normalizeOptionalString(args.timezone) ?? undefined,
    linkedinUrl: normalizeOptionalString(args.linkedinUrl) ?? undefined,
    twitterUrl: normalizeOptionalString(args.twitterUrl) ?? undefined,
    instagramUrl: normalizeOptionalString(args.instagramUrl) ?? undefined,
    facebookUrl: normalizeOptionalString(args.facebookUrl) ?? undefined,
    ceoName: normalizeOptionalString(args.ceoName) ?? undefined,
    financeContact: normalizeOptionalString(args.financeContact) ?? undefined,
    financeContactEmail:
      normalizeEmail(args.financeContactEmail) ?? undefined,
    primaryLanguage:
      normalizeOptionalString(args.primaryLanguage) ?? undefined,
    fiscalYearEnd: normalizeOptionalString(args.fiscalYearEnd) ?? undefined,
    enrichmentStatus:
      normalizeOptionalString(args.enrichmentStatus) ?? undefined,
    enrichedAt: normalizeOptionalString(args.enrichedAt) ?? undefined,
    portalEnabled: args.portalEnabled ?? undefined,
    portalId: normalizeOptionalString(args.portalId) ?? undefined,
  };
}

function getCustomerSearchText(
  customer: Pick<
    Doc<"customers">,
    | "name"
    | "email"
    | "billingEmail"
    | "website"
    | "phone"
    | "contact"
    | "note"
    | "description"
    | "industry"
    | "city"
    | "state"
    | "country"
    | "financeContact"
    | "financeContactEmail"
    | "status"
    | "preferredCurrency"
    | "externalId"
    | "vatNumber"
    | "companyType"
  >,
) {
  return (
    buildSearchIndexText([
      customer.name,
      customer.email,
      customer.billingEmail,
      customer.website,
      customer.phone,
      customer.contact,
      customer.note,
      customer.description,
      customer.industry,
      customer.city,
      customer.state,
      customer.country,
      customer.financeContact,
      customer.financeContactEmail,
      customer.status,
      customer.preferredCurrency,
      customer.externalId,
      customer.vatNumber,
      customer.companyType,
    ]) || undefined
  );
}

export const serviceGetCustomerById = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    customerId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return null;
    }

    const customer = await getCustomerByPublicId(ctx, {
      customerId: args.customerId,
      teamId: team._id,
    });

    return customer ? serializeCustomer(customer, args.teamId) : null;
  },
});

export const serviceGetCustomersByIds = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    customerIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.customerIds.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return [];
    }

    const customers = await Promise.all(
      [...new Set(args.customerIds)].map((customerId) =>
        getCustomerByPublicId(ctx, {
          customerId,
          teamId: team._id,
        }),
      ),
    );

    return customers
      .filter((customer): customer is NonNullable<typeof customer> => customer !== null)
      .map((customer) => serializeCustomer(customer, args.teamId));
  },
});

export const serviceListCustomers = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return [];
    }

    const customers = await ctx.db
      .query("customers")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    return customers
      .sort((left, right) => {
        const createdAtDiff = right.createdAt.localeCompare(left.createdAt);

        if (createdAtDiff !== 0) {
          return createdAtDiff;
        }

        return right.name.localeCompare(left.name);
      })
      .map((customer) => serializeCustomer(customer, args.teamId));
  },
});

export const serviceListCustomersPage = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    order: v.optional(customerOrderValidator),
    paginationOpts: paginationOptsValidator,
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return {
        page: [],
        isDone: true,
        continueCursor: args.paginationOpts.cursor ?? "",
        splitCursor: null,
        pageStatus: null,
      };
    }

    const result = await ctx.db
      .query("customers")
      .withIndex("by_team_created_at", (q) => q.eq("teamId", team._id))
      .order(args.order ?? "desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((customer) =>
        serializeCustomer(customer, args.teamId),
      ),
    };
  },
});

export const serviceSearchCustomers = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    query: v.string(),
    status: nullableString,
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);
    const searchQuery = buildSearchQuery(args.query);

    if (!team || searchQuery.length === 0) {
      return [];
    }

    const customers = await ctx.db
      .query("customers")
      .withSearchIndex("search_by_team", (q) =>
        q.search("searchText", searchQuery).eq("teamId", team._id),
      )
      .take(Math.max(1, Math.min((args.limit ?? 100) * 4, 400)));

    return customers
      .filter((customer) =>
        args.status === undefined || args.status === null
          ? true
          : customer.status === args.status,
      )
      .slice(0, args.limit ?? customers.length)
      .map((customer) => serializeCustomer(customer, args.teamId));
  },
});

export const serviceUpsertCustomer = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    id: nullableString,
    createdAt: nullableString,
    name: v.string(),
    email: v.string(),
    billingEmail: nullableString,
    country: nullableString,
    addressLine1: nullableString,
    addressLine2: nullableString,
    city: nullableString,
    state: nullableString,
    zip: nullableString,
    note: nullableString,
    website: nullableString,
    phone: nullableString,
    vatNumber: nullableString,
    countryCode: nullableString,
    token: nullableString,
    contact: nullableString,
    status: nullableString,
    preferredCurrency: nullableString,
    defaultPaymentTerms: nullableNumber,
    isArchived: nullableBoolean,
    source: nullableString,
    externalId: nullableString,
    logoUrl: nullableString,
    description: nullableString,
    industry: nullableString,
    companyType: nullableString,
    employeeCount: nullableString,
    foundedYear: nullableNumber,
    estimatedRevenue: nullableString,
    fundingStage: nullableString,
    totalFunding: nullableString,
    headquartersLocation: nullableString,
    timezone: nullableString,
    linkedinUrl: nullableString,
    twitterUrl: nullableString,
    instagramUrl: nullableString,
    facebookUrl: nullableString,
    ceoName: nullableString,
    financeContact: nullableString,
    financeContactEmail: nullableString,
    primaryLanguage: nullableString,
    fiscalYearEnd: nullableString,
    enrichmentStatus: nullableString,
    enrichedAt: nullableString,
    portalEnabled: nullableBoolean,
    portalId: nullableString,
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.teamId);
    const timestamp = nowIso();
    const customerId = args.id ?? crypto.randomUUID();
    const normalized = normalizeCustomerValues(args);
    const searchText = getCustomerSearchText({
      ...normalized,
      name: normalized.name,
      email: normalized.email,
    });
    const existing = await getCustomerByPublicId(ctx, {
      customerId,
      teamId: team._id,
    });

    if (existing) {
      await ctx.db.patch(existing._id, {
        publicCustomerId: existing.publicCustomerId ?? customerId,
        teamId: team._id,
        createdAt: normalized.createdAt ?? existing.createdAt,
        name: normalized.name,
        email: normalized.email,
        billingEmail: normalized.billingEmail,
        country: normalized.country,
        addressLine1: normalized.addressLine1,
        addressLine2: normalized.addressLine2,
        city: normalized.city,
        state: normalized.state,
        zip: normalized.zip,
        note: normalized.note,
        website: normalized.website,
        phone: normalized.phone,
        vatNumber: normalized.vatNumber,
        countryCode: normalized.countryCode,
        token: normalized.token,
        contact: normalized.contact,
        status: normalized.status ?? "active",
        preferredCurrency: normalized.preferredCurrency,
        defaultPaymentTerms: normalized.defaultPaymentTerms,
        isArchived: normalized.isArchived ?? false,
        source: normalized.source ?? "manual",
        externalId: normalized.externalId,
        logoUrl: normalized.logoUrl,
        description: normalized.description,
        industry: normalized.industry,
        companyType: normalized.companyType,
        employeeCount: normalized.employeeCount,
        foundedYear: normalized.foundedYear,
        estimatedRevenue: normalized.estimatedRevenue,
        fundingStage: normalized.fundingStage,
        totalFunding: normalized.totalFunding,
        headquartersLocation: normalized.headquartersLocation,
        timezone: normalized.timezone,
        linkedinUrl: normalized.linkedinUrl,
        twitterUrl: normalized.twitterUrl,
        instagramUrl: normalized.instagramUrl,
        facebookUrl: normalized.facebookUrl,
        ceoName: normalized.ceoName,
        financeContact: normalized.financeContact,
        financeContactEmail: normalized.financeContactEmail,
        primaryLanguage: normalized.primaryLanguage,
        fiscalYearEnd: normalized.fiscalYearEnd,
        enrichmentStatus: normalized.enrichmentStatus,
        enrichedAt: normalized.enrichedAt,
        portalEnabled: normalized.portalEnabled ?? false,
        portalId: normalized.portalId,
        searchText,
        updatedAt: timestamp,
      });

      const updated = await ctx.db.get(existing._id);

      if (!updated) {
        throw new ConvexError("Failed to update customer");
      }

      return serializeCustomer(updated, args.teamId);
    }

    const insertedId = await ctx.db.insert("customers", {
      publicCustomerId: customerId,
      teamId: team._id,
      createdAt: normalized.createdAt ?? timestamp,
      updatedAt: timestamp,
      name: normalized.name,
      email: normalized.email,
      billingEmail: normalized.billingEmail,
      country: normalized.country,
      addressLine1: normalized.addressLine1,
      addressLine2: normalized.addressLine2,
      city: normalized.city,
      state: normalized.state,
      zip: normalized.zip,
      note: normalized.note,
      website: normalized.website,
      phone: normalized.phone,
      vatNumber: normalized.vatNumber,
      countryCode: normalized.countryCode,
      token: normalized.token,
      contact: normalized.contact,
      status: normalized.status ?? "active",
      preferredCurrency: normalized.preferredCurrency,
      defaultPaymentTerms: normalized.defaultPaymentTerms,
      isArchived: normalized.isArchived ?? false,
      source: normalized.source ?? "manual",
      externalId: normalized.externalId,
      logoUrl: normalized.logoUrl,
      description: normalized.description,
      industry: normalized.industry,
      companyType: normalized.companyType,
      employeeCount: normalized.employeeCount,
      foundedYear: normalized.foundedYear,
      estimatedRevenue: normalized.estimatedRevenue,
      fundingStage: normalized.fundingStage,
      totalFunding: normalized.totalFunding,
      headquartersLocation: normalized.headquartersLocation,
      timezone: normalized.timezone,
      linkedinUrl: normalized.linkedinUrl,
      twitterUrl: normalized.twitterUrl,
      instagramUrl: normalized.instagramUrl,
      facebookUrl: normalized.facebookUrl,
      ceoName: normalized.ceoName,
      financeContact: normalized.financeContact,
      financeContactEmail: normalized.financeContactEmail,
      primaryLanguage: normalized.primaryLanguage,
      fiscalYearEnd: normalized.fiscalYearEnd,
      enrichmentStatus: normalized.enrichmentStatus,
      enrichedAt: normalized.enrichedAt,
      portalEnabled: normalized.portalEnabled ?? false,
      portalId: normalized.portalId,
      searchText,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create customer");
    }

    return serializeCustomer(inserted, args.teamId);
  },
});

export const serviceRebuildCustomerSearchTexts = mutation({
  args: {
    serviceKey: v.string(),
    teamId: nullableString,
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const teams = args.teamId
      ? [await getTeamByPublicTeamId(ctx, args.teamId)]
      : (await ctx.db.query("teams").collect()).filter(
          (team) => !!team.publicTeamId,
        );

    const validTeams = teams.filter(
      (team): team is NonNullable<(typeof teams)[number]> => team !== null,
    );

    if (args.teamId && validTeams.length === 0) {
      throw new ConvexError("Convex customer team not found");
    }

    const results = [];

    for (const team of validTeams) {
      const customers = await ctx.db
        .query("customers")
        .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
        .collect();
      let updatedCustomerCount = 0;

      for (const customer of customers) {
        const searchText = getCustomerSearchText(customer);

        if (customer.searchText === searchText) {
          continue;
        }

        await ctx.db.patch(customer._id, {
          searchText,
        });
        updatedCustomerCount += 1;
      }

      results.push({
        teamId: team.publicTeamId ?? team._id,
        customerCount: customers.length,
        updatedCustomerCount,
      });
    }

    return results;
  },
});

export const serviceDeleteCustomer = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    customerId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.teamId);
    const customer = await getCustomerByPublicId(ctx, {
      customerId: args.customerId,
      teamId: team._id,
    });

    if (!customer) {
      return null;
    }

    await ctx.db.delete(customer._id);

    return { id: publicCustomerId(customer)! };
  },
});

export const serviceToggleCustomerPortal = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    customerId: v.string(),
    enabled: v.boolean(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.teamId);
    const customer = await getCustomerByPublicId(ctx, {
      customerId: args.customerId,
      teamId: team._id,
    });

    if (!customer) {
      throw new ConvexError("Customer not found");
    }

    const portalId =
      args.enabled && !customer.portalId
        ? crypto.randomUUID().replaceAll("-", "").slice(0, 21)
        : customer.portalId;

    await ctx.db.patch(customer._id, {
      portalEnabled: args.enabled,
      portalId: portalId ?? undefined,
      updatedAt: nowIso(),
    });

    const updated = await ctx.db.get(customer._id);

    if (!updated) {
      throw new ConvexError("Failed to update customer portal");
    }

    return {
      id: publicCustomerId(updated)!,
      portalEnabled: updated.portalEnabled ?? false,
      portalId: updated.portalId ?? null,
    };
  },
});

export const serviceGetCustomerByPortalId = query({
  args: {
    serviceKey: v.string(),
    portalId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const customer = await ctx.db
      .query("customers")
      .withIndex("by_portal_id", (q) => q.eq("portalId", args.portalId))
      .unique();

    if (!customer || !customer.portalEnabled) {
      return null;
    }

    const team = await ctx.db.get(customer.teamId);

    if (!team) {
      return null;
    }

    return serializeCustomer(customer, publicTeamId(team) ?? team._id);
  },
});

export const serviceGetCustomerForEnrichment = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    customerId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return null;
    }

    const customer = await getCustomerByPublicId(ctx, {
      customerId: args.customerId,
      teamId: team._id,
    });

    if (!customer) {
      return null;
    }

    return {
      id: publicCustomerId(customer)!,
      name: customer.name,
      website: customer.website ?? null,
      teamId: args.teamId,
      email: customer.email ?? null,
      country: customer.country ?? null,
      countryCode: customer.countryCode ?? null,
      city: customer.city ?? null,
      state: customer.state ?? null,
      addressLine1: customer.addressLine1 ?? null,
      phone: customer.phone ?? null,
      vatNumber: customer.vatNumber ?? null,
      note: customer.note ?? null,
      contact: customer.contact ?? null,
    };
  },
});

export const serviceUpdateCustomerEnrichmentStatus = mutation({
  args: {
    serviceKey: v.string(),
    customerId: v.string(),
    status: nullableString,
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const customer = await getCustomerByPublicId(ctx, {
      customerId: args.customerId,
    });

    if (!customer) {
      return null;
    }

    await ctx.db.patch(customer._id, {
      enrichmentStatus: normalizeOptionalString(args.status) ?? undefined,
      enrichedAt:
        args.status === "completed"
          ? nowIso()
          : customer.enrichedAt ?? undefined,
      updatedAt: nowIso(),
    });

    return { id: publicCustomerId(customer)! };
  },
});

export const serviceUpdateCustomerEnrichment = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    customerId: v.string(),
    description: nullableString,
    industry: nullableString,
    companyType: nullableString,
    employeeCount: nullableString,
    foundedYear: nullableNumber,
    estimatedRevenue: nullableString,
    fundingStage: nullableString,
    totalFunding: nullableString,
    headquartersLocation: nullableString,
    timezone: nullableString,
    linkedinUrl: nullableString,
    twitterUrl: nullableString,
    instagramUrl: nullableString,
    facebookUrl: nullableString,
    ceoName: nullableString,
    financeContact: nullableString,
    financeContactEmail: nullableString,
    primaryLanguage: nullableString,
    fiscalYearEnd: nullableString,
    vatNumber: nullableString,
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.teamId);
    const customer = await getCustomerByPublicId(ctx, {
      customerId: args.customerId,
      teamId: team._id,
    });

    if (!customer) {
      throw new ConvexError("Customer not found");
    }

    await ctx.db.patch(customer._id, {
      description: normalizeOptionalString(args.description) ?? undefined,
      industry: normalizeOptionalString(args.industry) ?? undefined,
      companyType: normalizeOptionalString(args.companyType) ?? undefined,
      employeeCount: normalizeOptionalString(args.employeeCount) ?? undefined,
      foundedYear: args.foundedYear ?? undefined,
      estimatedRevenue:
        normalizeOptionalString(args.estimatedRevenue) ?? undefined,
      fundingStage: normalizeOptionalString(args.fundingStage) ?? undefined,
      totalFunding: normalizeOptionalString(args.totalFunding) ?? undefined,
      headquartersLocation:
        normalizeOptionalString(args.headquartersLocation) ?? undefined,
      timezone: normalizeOptionalString(args.timezone) ?? undefined,
      linkedinUrl: normalizeOptionalString(args.linkedinUrl) ?? undefined,
      twitterUrl: normalizeOptionalString(args.twitterUrl) ?? undefined,
      instagramUrl: normalizeOptionalString(args.instagramUrl) ?? undefined,
      facebookUrl: normalizeOptionalString(args.facebookUrl) ?? undefined,
      ceoName: normalizeOptionalString(args.ceoName) ?? undefined,
      financeContact:
        normalizeOptionalString(args.financeContact) ?? undefined,
      financeContactEmail:
        normalizeEmail(args.financeContactEmail) ?? undefined,
      primaryLanguage:
        normalizeOptionalString(args.primaryLanguage) ?? undefined,
      fiscalYearEnd: normalizeOptionalString(args.fiscalYearEnd) ?? undefined,
      vatNumber: normalizeOptionalString(args.vatNumber) ?? undefined,
      searchText: getCustomerSearchText({
        ...customer,
        description: normalizeOptionalString(args.description) ?? undefined,
        industry: normalizeOptionalString(args.industry) ?? undefined,
        companyType: normalizeOptionalString(args.companyType) ?? undefined,
        financeContact:
          normalizeOptionalString(args.financeContact) ?? undefined,
        financeContactEmail:
          normalizeEmail(args.financeContactEmail) ?? undefined,
        vatNumber: normalizeOptionalString(args.vatNumber) ?? undefined,
      }),
      enrichmentStatus: "completed",
      enrichedAt: nowIso(),
      updatedAt: nowIso(),
    });

    return { id: publicCustomerId(customer)! };
  },
});

export const serviceMarkCustomerEnrichmentFailed = mutation({
  args: {
    serviceKey: v.string(),
    customerId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const customer = await getCustomerByPublicId(ctx, {
      customerId: args.customerId,
    });

    if (!customer) {
      return null;
    }

    await ctx.db.patch(customer._id, {
      enrichmentStatus: "failed",
      updatedAt: nowIso(),
    });

    return { id: publicCustomerId(customer)! };
  },
});

export const serviceGetCustomersNeedingEnrichment = query({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.teamId);

    if (!team) {
      return [];
    }

    const customers = await ctx.db
      .query("customers")
      .withIndex("by_team_and_enrichment_status", (q) =>
        q.eq("teamId", team._id).eq("enrichmentStatus", "pending"),
      )
      .take(args.limit ?? 50);

    return customers.map((customer) => ({
      id: publicCustomerId(customer)!,
      name: customer.name,
      website: customer.website ?? null,
      teamId: args.teamId,
      email: customer.email ?? null,
      country: customer.country ?? null,
      countryCode: customer.countryCode ?? null,
      city: customer.city ?? null,
      state: customer.state ?? null,
      addressLine1: customer.addressLine1 ?? null,
      phone: customer.phone ?? null,
      vatNumber: customer.vatNumber ?? null,
      note: customer.note ?? null,
      contact: customer.contact ?? null,
    }));
  },
});

export const serviceClearCustomerEnrichment = mutation({
  args: {
    serviceKey: v.string(),
    teamId: v.string(),
    customerId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrThrow(ctx, args.teamId);
    const customer = await getCustomerByPublicId(ctx, {
      customerId: args.customerId,
      teamId: team._id,
    });

    if (!customer) {
      throw new ConvexError("Customer not found");
    }

    await ctx.db.patch(customer._id, {
      description: undefined,
      industry: undefined,
      companyType: undefined,
      employeeCount: undefined,
      foundedYear: undefined,
      estimatedRevenue: undefined,
      fundingStage: undefined,
      totalFunding: undefined,
      headquartersLocation: undefined,
      timezone: undefined,
      linkedinUrl: undefined,
      twitterUrl: undefined,
      instagramUrl: undefined,
      facebookUrl: undefined,
      ceoName: undefined,
      financeContact: undefined,
      financeContactEmail: undefined,
      searchText: getCustomerSearchText({
        ...customer,
        description: undefined,
        industry: undefined,
        companyType: undefined,
        financeContact: undefined,
        financeContactEmail: undefined,
      }),
      primaryLanguage: undefined,
      fiscalYearEnd: undefined,
      enrichmentStatus: undefined,
      enrichedAt: undefined,
      updatedAt: nowIso(),
    });

    return { id: publicCustomerId(customer)! };
  },
});
