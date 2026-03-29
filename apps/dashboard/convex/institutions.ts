import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nowIso } from "../../../packages/domain/src/identity";
import { requireServiceKey } from "./lib/service";

const excludedInstitutions = new Set([
  "ins_56",
]);

const institutionProvider = v.union(
  v.literal("gocardless"),
  v.literal("plaid"),
  v.literal("teller"),
);

const institutionStatus = v.union(v.literal("active"), v.literal("removed"));

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function serializeInstitution(record: {
  institutionId: string;
  name: string;
  logo?: string;
  provider: "gocardless" | "plaid" | "teller";
  countries: string[];
  availableHistory?: number | null;
  maximumConsentValidity?: number | null;
  popularity: number;
  type?: string | null;
}) {
  return {
    id: record.institutionId,
    name: record.name,
    logo: record.logo ?? null,
    popularity: record.popularity,
    availableHistory: record.availableHistory ?? null,
    maximumConsentValidity: record.maximumConsentValidity ?? null,
    provider: record.provider,
    type: record.type ?? null,
    countries: record.countries,
  };
}

function getSearchRank(name: string, queryText: string) {
  const normalizedName = normalizeSearchValue(name);
  const normalizedQuery = normalizeSearchValue(queryText);

  if (!normalizedQuery) {
    return 1;
  }

  if (normalizedName === normalizedQuery) {
    return 5;
  }

  if (normalizedName.startsWith(normalizedQuery)) {
    return 4;
  }

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const containsAllTokens = queryTokens.every((token) =>
    normalizedName.includes(token),
  );

  if (containsAllTokens) {
    return 3;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return 2;
  }

  return 0;
}

export const serviceGetInstitutions = query({
  args: {
    serviceKey: v.string(),
    countryCode: v.string(),
    q: v.optional(v.string()),
    limit: v.optional(v.number()),
    excludeProviders: v.optional(v.array(institutionProvider)),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const limit = args.limit ?? 50;
    const hasSearch = !!args.q && args.q !== "*";
    const excludedProviders = new Set(args.excludeProviders ?? []);

    const activeRecords = await ctx.db
      .query("institutions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const ranked = activeRecords
      .filter((record) => !excludedInstitutions.has(record.institutionId))
      .filter((record) => record.countries.includes(args.countryCode))
      .filter((record) => !excludedProviders.has(record.provider))
      .map((record) => ({
        record,
        rank: hasSearch ? getSearchRank(record.name, args.q!) : 1,
      }))
      .filter(({ rank }) => !hasSearch || rank > 0)
      .sort((left, right) => {
        if (left.rank !== right.rank) {
          return right.rank - left.rank;
        }

        if (left.record.popularity !== right.record.popularity) {
          return right.record.popularity - left.record.popularity;
        }

        return left.record.name.localeCompare(right.record.name);
      })
      .slice(0, limit);

    return ranked.map(({ record }) => serializeInstitution(record));
  },
});

export const serviceGetInstitutionById = query({
  args: {
    serviceKey: v.string(),
    id: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = await ctx.db
      .query("institutions")
      .withIndex("by_institution_id", (q) => q.eq("institutionId", args.id))
      .unique();

    return record ? serializeInstitution(record) : null;
  },
});

export const serviceUpdateInstitutionUsage = mutation({
  args: {
    serviceKey: v.string(),
    id: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = await ctx.db
      .query("institutions")
      .withIndex("by_institution_id", (q) => q.eq("institutionId", args.id))
      .unique();

    if (!record) {
      return null;
    }

    const updatedAt = nowIso();
    const popularity = record.popularity + 1;

    await ctx.db.patch(record._id, {
      popularity,
      updatedAt,
    });

    return serializeInstitution({
      ...record,
      popularity,
    });
  },
});

export const serviceUpsertInstitutions = mutation({
  args: {
    serviceKey: v.string(),
    institutions: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        logo: v.optional(v.union(v.string(), v.null())),
        provider: institutionProvider,
        countries: v.array(v.string()),
        availableHistory: v.optional(v.union(v.number(), v.null())),
        maximumConsentValidity: v.optional(v.union(v.number(), v.null())),
        popularity: v.number(),
        type: v.optional(v.union(v.string(), v.null())),
      }),
    ),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.institutions.length === 0) {
      return 0;
    }

    const timestamp = nowIso();
    let processed = 0;

    for (const institution of args.institutions) {
      const existing = await ctx.db
        .query("institutions")
        .withIndex("by_institution_id", (q) =>
          q.eq("institutionId", institution.id),
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          name: institution.name,
          normalizedName: normalizeSearchValue(institution.name),
          logo: institution.logo ?? undefined,
          provider: institution.provider,
          countries: institution.countries,
          availableHistory: institution.availableHistory ?? null,
          maximumConsentValidity:
            institution.maximumConsentValidity ?? null,
          type: institution.type ?? null,
          status: "active",
          updatedAt: timestamp,
        });
      } else {
        await ctx.db.insert("institutions", {
          institutionId: institution.id,
          name: institution.name,
          normalizedName: normalizeSearchValue(institution.name),
          logo: institution.logo ?? undefined,
          provider: institution.provider,
          countries: institution.countries,
          availableHistory: institution.availableHistory ?? null,
          maximumConsentValidity:
            institution.maximumConsentValidity ?? null,
          popularity: institution.popularity,
          type: institution.type ?? null,
          status: "active",
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }

      processed += 1;
    }

    return processed;
  },
});

export const serviceGetActiveInstitutionIds = query({
  args: {
    serviceKey: v.string(),
    providers: v.optional(v.array(institutionProvider)),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const allowedProviders = new Set(args.providers ?? []);

    const records = await ctx.db
      .query("institutions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    return records
      .filter((record) =>
        allowedProviders.size === 0 || allowedProviders.has(record.provider),
      )
      .map((record) => record.institutionId);
  },
});

export const serviceMarkInstitutionsRemoved = mutation({
  args: {
    serviceKey: v.string(),
    ids: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.ids.length === 0) {
      return 0;
    }

    const timestamp = nowIso();
    let updated = 0;

    for (const id of args.ids) {
      const record = await ctx.db
        .query("institutions")
        .withIndex("by_institution_id", (q) => q.eq("institutionId", id))
        .unique();

      if (!record || record.status === "removed") {
        continue;
      }

      await ctx.db.patch(record._id, {
        status: "removed",
        updatedAt: timestamp,
      });
      updated += 1;
    }

    return updated;
  },
});
