import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../../packages/domain/src/identity";

type InvoiceRecurringSeriesPayload = Record<string, unknown>;

function serializeInvoiceRecurringSeries(record: {
  _id: string;
  publicInvoiceRecurringId?: string;
  customerId?: string;
  customerName?: string;
  status: string;
  nextScheduledAt?: string;
  upcomingNotificationSentAt?: string;
  payload: InvoiceRecurringSeriesPayload;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: record.publicInvoiceRecurringId ?? record._id,
    customerId: record.customerId ?? null,
    customerName: record.customerName ?? null,
    status: record.status,
    nextScheduledAt: record.nextScheduledAt ?? null,
    upcomingNotificationSentAt: record.upcomingNotificationSentAt ?? null,
    payload: record.payload,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export const serviceUpsertInvoiceRecurringSeries = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceRecurringId: v.string(),
    customerId: v.optional(v.union(v.string(), v.null())),
    customerName: v.optional(v.union(v.string(), v.null())),
    status: v.string(),
    nextScheduledAt: v.optional(v.union(v.string(), v.null())),
    upcomingNotificationSentAt: v.optional(v.union(v.string(), v.null())),
    payload: v.any(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex invoice recurring team not found");
    }

    const timestamp = nowIso();
    const payload = args.payload as InvoiceRecurringSeriesPayload;
    const existing = await ctx.db
      .query("invoiceRecurringSeries")
      .withIndex("by_team_and_public_invoice_recurring_id", (q) =>
        q.eq("teamId", team._id).eq("publicInvoiceRecurringId", args.invoiceRecurringId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        publicInvoiceRecurringId:
          existing.publicInvoiceRecurringId ?? args.invoiceRecurringId,
        teamId: team._id,
        customerId: args.customerId ?? undefined,
        customerName: args.customerName ?? undefined,
        status: args.status,
        nextScheduledAt: args.nextScheduledAt ?? undefined,
        upcomingNotificationSentAt:
          args.upcomingNotificationSentAt ?? undefined,
        payload,
        updatedAt: timestamp,
      });

      const updated = await ctx.db.get(existing._id);

      if (!updated) {
        throw new ConvexError("Failed to update invoice recurring projection");
      }

      return serializeInvoiceRecurringSeries({
        _id: updated._id,
        publicInvoiceRecurringId: updated.publicInvoiceRecurringId,
        customerId: updated.customerId,
        customerName: updated.customerName,
        status: updated.status,
        nextScheduledAt: updated.nextScheduledAt,
        upcomingNotificationSentAt: updated.upcomingNotificationSentAt,
        payload: updated.payload as InvoiceRecurringSeriesPayload,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    }

    const insertedId = await ctx.db.insert("invoiceRecurringSeries", {
      publicInvoiceRecurringId: args.invoiceRecurringId,
      teamId: team._id,
      customerId: args.customerId ?? undefined,
      customerName: args.customerName ?? undefined,
      status: args.status,
      nextScheduledAt: args.nextScheduledAt ?? undefined,
      upcomingNotificationSentAt:
        args.upcomingNotificationSentAt ?? undefined,
      payload,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create invoice recurring projection");
    }

    return serializeInvoiceRecurringSeries({
      _id: inserted._id,
      publicInvoiceRecurringId: inserted.publicInvoiceRecurringId,
      customerId: inserted.customerId,
      customerName: inserted.customerName,
      status: inserted.status,
      nextScheduledAt: inserted.nextScheduledAt,
      upcomingNotificationSentAt: inserted.upcomingNotificationSentAt,
      payload: inserted.payload as InvoiceRecurringSeriesPayload,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    });
  },
});

export const serviceGetInvoiceRecurringSeriesByLegacyId = query({
  args: {
    serviceKey: v.string(),
    invoiceRecurringId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = await ctx.db
      .query("invoiceRecurringSeries")
      .withIndex("by_public_invoice_recurring_id", (q) =>
        q.eq("publicInvoiceRecurringId", args.invoiceRecurringId),
      )
      .unique();

    if (!record) {
      return null;
    }

    return serializeInvoiceRecurringSeries({
      _id: record._id,
      publicInvoiceRecurringId: record.publicInvoiceRecurringId,
      customerId: record.customerId,
      customerName: record.customerName,
      status: record.status,
      nextScheduledAt: record.nextScheduledAt,
      upcomingNotificationSentAt: record.upcomingNotificationSentAt,
      payload: record.payload as InvoiceRecurringSeriesPayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});

export const serviceGetInvoiceRecurringSeriesByTeam = query({
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

    const records = await ctx.db
      .query("invoiceRecurringSeries")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    return records.map((record) =>
      serializeInvoiceRecurringSeries({
        _id: record._id,
        publicInvoiceRecurringId: record.publicInvoiceRecurringId,
        customerId: record.customerId,
        customerName: record.customerName,
        status: record.status,
        nextScheduledAt: record.nextScheduledAt,
        upcomingNotificationSentAt: record.upcomingNotificationSentAt,
        payload: record.payload as InvoiceRecurringSeriesPayload,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }),
    );
  },
});

export const serviceGetDueInvoiceRecurringSeries = query({
  args: {
    serviceKey: v.string(),
    before: v.string(),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const limit = args.limit ?? 50;
    const records = await ctx.db
      .query("invoiceRecurringSeries")
      .withIndex("by_status_and_next_scheduled_at", (q) =>
        q.eq("status", "active").lte("nextScheduledAt", args.before),
      )
      .take(limit);

    return records.map((record) =>
      serializeInvoiceRecurringSeries({
        _id: record._id,
        publicInvoiceRecurringId: record.publicInvoiceRecurringId,
        customerId: record.customerId,
        customerName: record.customerName,
        status: record.status,
        nextScheduledAt: record.nextScheduledAt,
        upcomingNotificationSentAt: record.upcomingNotificationSentAt,
        payload: record.payload as InvoiceRecurringSeriesPayload,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }),
    );
  },
});

export const serviceGetUpcomingInvoiceRecurringSeries = query({
  args: {
    serviceKey: v.string(),
    after: v.string(),
    before: v.string(),
    limit: v.optional(v.number()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const limit = args.limit ?? 100;
    const records = await ctx.db
      .query("invoiceRecurringSeries")
      .withIndex("by_status_and_next_scheduled_at", (q) =>
        q.eq("status", "active")
          .gt("nextScheduledAt", args.after)
          .lte("nextScheduledAt", args.before),
      )
      .take(limit);

    return records.map((record) =>
      serializeInvoiceRecurringSeries({
        _id: record._id,
        publicInvoiceRecurringId: record.publicInvoiceRecurringId,
        customerId: record.customerId,
        customerName: record.customerName,
        status: record.status,
        nextScheduledAt: record.nextScheduledAt,
        upcomingNotificationSentAt: record.upcomingNotificationSentAt,
        payload: record.payload as InvoiceRecurringSeriesPayload,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }),
    );
  },
});
