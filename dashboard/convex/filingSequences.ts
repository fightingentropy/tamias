import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

export const serviceAllocateFilingSequence = mutation({
  args: {
    serviceKey: v.string(),
    scope: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const scope = args.scope.trim();

    if (!scope) {
      throw new ConvexError("Convex filing sequence scope is required");
    }

    const timestamp = nowIso();
    const records = await ctx.db
      .query("filingSequences")
      .withIndex("by_scope", (q) => q.eq("scope", scope))
      .collect();

    if (records.length === 0) {
      await ctx.db.insert("filingSequences", {
        scope,
        nextValue: 2,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      return 1;
    }

    const [primaryRecord, ...duplicateRecords] = records.sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );

    if (!primaryRecord) {
      throw new ConvexError("Convex filing sequence record missing");
    }

    const nextValue = Math.max(
      1,
      ...records.map((record) => Math.max(1, Math.trunc(record.nextValue))),
    );

    await ctx.db.patch(primaryRecord._id, {
      nextValue: nextValue + 1,
      updatedAt: timestamp,
    });

    await Promise.all(duplicateRecords.map((record) => ctx.db.delete(record._id)));

    return nextValue;
  },
});
