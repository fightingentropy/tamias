import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireServiceKey } from "./lib/service";

export const serviceGetExchangeRatesForTarget = query({
  args: {
    serviceKey: v.string(),
    target: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const records = await ctx.db
      .query("exchangeRates")
      .withIndex("by_target", (q) => q.eq("target", args.target))
      .collect();

    return records.map((record) => ({
      base: record.base,
      target: record.target,
      rate: record.rate,
      updatedAt: record.updatedAt,
    }));
  },
});

export const serviceUpsertExchangeRates = mutation({
  args: {
    serviceKey: v.string(),
    rates: v.array(
      v.object({
        base: v.string(),
        target: v.string(),
        rate: v.number(),
        updatedAt: v.string(),
      }),
    ),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    let processed = 0;

    for (const rate of args.rates) {
      const existing = await ctx.db
        .query("exchangeRates")
        .withIndex("by_base_target", (q) => q.eq("base", rate.base).eq("target", rate.target))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          rate: rate.rate,
          updatedAt: rate.updatedAt,
        });
      } else {
        await ctx.db.insert("exchangeRates", {
          base: rate.base,
          target: rate.target,
          rate: rate.rate,
          updatedAt: rate.updatedAt,
        });
      }

      processed += 1;
    }

    return { processed };
  },
});
