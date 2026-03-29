import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { nowIso } from "../../../packages/domain/src/identity";
import type { Doc } from "./_generated/dataModel";
import {
  type MutationCtx,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";

type PublicInvoicePayload = Record<string, unknown>;
type ReadCtx = QueryCtx | MutationCtx;
type PublicInvoiceDoc = Doc<"publicInvoices">;
type TeamDoc = Doc<"teams">;
const INVOICE_NUMBER_PREFIX = "INV-";
const INVOICE_NUMBER_PAD_LENGTH = 4;
const INVOICE_NUMBER_CONFLICT_PREFIX = "INVOICE_NUMBER_ALREADY_USED:";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const publicInvoiceDateFieldValidator = v.union(
  v.literal("createdAt"),
  v.literal("issueDate"),
  v.literal("sentAt"),
  v.literal("dueDate"),
  v.literal("paidAt"),
);
const publicInvoiceOrderValidator = v.union(v.literal("asc"), v.literal("desc"));

type PublicInvoiceDateField =
  | "createdAt"
  | "issueDate"
  | "sentAt"
  | "dueDate"
  | "paidAt";
type PublicInvoiceProjectionFields = {
  invoiceNumber?: string;
  invoiceRecurringId?: string;
  recurringSequence?: number;
  customerId?: string;
  customerName?: string;
  currency?: string;
  amount?: number;
  issueDate?: string;
  sentAt?: string;
  dueDate?: string;
  paidAt?: string;
};

function getStringFieldFromPayload(
  payload: PublicInvoicePayload,
  key: string,
) {
  return typeof payload[key] === "string" && payload[key].length > 0
    ? payload[key]
    : null;
}

function getNumberFieldFromPayload(
  payload: PublicInvoicePayload,
  key: string,
) {
  return typeof payload[key] === "number" ? payload[key] : null;
}

function getInvoiceNumberFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "invoiceNumber");
}

function getInvoiceRecurringIdFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "invoiceRecurringId");
}

function getRecurringSequenceFromPayload(payload: PublicInvoicePayload) {
  return typeof payload.recurringSequence === "number"
    ? payload.recurringSequence
    : null;
}

function getCustomerIdFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "customerId");
}

function getCustomerNameFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "customerName");
}

function getCurrencyFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "currency");
}

function getAmountFromPayload(payload: PublicInvoicePayload) {
  return getNumberFieldFromPayload(payload, "amount");
}

function getIssueDateFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "issueDate");
}

function getSentAtFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "sentAt");
}

function getDueDateFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "dueDate");
}

function getPaidAtFromPayload(payload: PublicInvoicePayload) {
  return getStringFieldFromPayload(payload, "paidAt");
}

function getPublicInvoiceProjectionFields(
  payload: PublicInvoicePayload,
  invoiceNumberOverride?: string | null,
): PublicInvoiceProjectionFields {
  return {
    invoiceNumber:
      (invoiceNumberOverride ?? getInvoiceNumberFromPayload(payload)) ??
      undefined,
    invoiceRecurringId: getInvoiceRecurringIdFromPayload(payload) ?? undefined,
    recurringSequence: getRecurringSequenceFromPayload(payload) ?? undefined,
    customerId: getCustomerIdFromPayload(payload) ?? undefined,
    customerName: getCustomerNameFromPayload(payload) ?? undefined,
    currency: getCurrencyFromPayload(payload) ?? undefined,
    amount: getAmountFromPayload(payload) ?? undefined,
    issueDate: getIssueDateFromPayload(payload) ?? undefined,
    sentAt: getSentAtFromPayload(payload) ?? undefined,
    dueDate: getDueDateFromPayload(payload) ?? undefined,
    paidAt: getPaidAtFromPayload(payload) ?? undefined,
  };
}

function parseInvoiceNumberSequence(invoiceNumber: string | null | undefined) {
  if (!invoiceNumber) {
    return null;
  }

  const match = invoiceNumber.match(/(\d+)$/);

  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function formatInvoiceNumber(sequence: number) {
  return `${INVOICE_NUMBER_PREFIX}${sequence.toString().padStart(INVOICE_NUMBER_PAD_LENGTH, "0")}`;
}

function buildInvoiceNumberConflictError(invoiceNumber: string) {
  return new ConvexError(`${INVOICE_NUMBER_CONFLICT_PREFIX}${invoiceNumber}`);
}

async function getTeamPublicInvoices(ctx: ReadCtx, teamId: TeamDoc["_id"]) {
  return ctx.db
    .query("publicInvoices")
    .withIndex("by_team_id", (q) => q.eq("teamId", teamId))
    .collect();
}

function getNextInvoiceSequenceFromRecords(records: PublicInvoiceDoc[]) {
  const numericSequences = records
    .map((record) => parseInvoiceNumberSequence(record.invoiceNumber))
    .filter((value): value is number => value !== null);

  if (numericSequences.length > 0) {
    return Math.max(...numericSequences) + 1;
  }

  return records.length + 1;
}

async function getInitialNextInvoiceSequence(
  ctx: ReadCtx,
  teamId: TeamDoc["_id"],
) {
  const records = await getTeamPublicInvoices(ctx, teamId);

  return getNextInvoiceSequenceFromRecords(records);
}

async function getNextInvoiceSequencePreview(
  ctx: QueryCtx,
  teamId: TeamDoc["_id"],
) {
  const records = await getTeamPublicInvoices(ctx, teamId);

  return getNextInvoiceSequenceFromRecords(records);
}

async function getNextInvoiceSequence(
  ctx: MutationCtx,
  team: Pick<TeamDoc, "_id" | "nextInvoiceSequence">,
) {
  if (typeof team.nextInvoiceSequence === "number") {
    return team.nextInvoiceSequence;
  }

  return getInitialNextInvoiceSequence(ctx, team._id);
}

async function advanceNextInvoiceSequenceIfNeeded(
  ctx: MutationCtx,
  team: Pick<TeamDoc, "_id" | "nextInvoiceSequence">,
  invoiceNumber: string | null,
) {
  const parsedSequence = parseInvoiceNumberSequence(invoiceNumber);

  if (parsedSequence === null) {
    return;
  }

  const currentNextSequence = await getNextInvoiceSequence(ctx, team);
  const desiredNextSequence = Math.max(currentNextSequence, parsedSequence + 1);

  if (desiredNextSequence !== currentNextSequence) {
    await ctx.db.patch(team._id, {
      nextInvoiceSequence: desiredNextSequence,
    });
  }
}

function sortByNewestCreatedAt(records: PublicInvoiceDoc[]) {
  return [...records].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

function sortByRecurringSequence(
  records: PublicInvoiceDoc[],
  direction: "asc" | "desc" = "asc",
) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...records].sort((left, right) => {
    const leftSequence = left.recurringSequence ?? 0;
    const rightSequence = right.recurringSequence ?? 0;
    const sequenceDelta = leftSequence - rightSequence;

    if (sequenceDelta !== 0) {
      return sequenceDelta * multiplier;
    }

    return left.createdAt.localeCompare(right.createdAt) * multiplier;
  });
}

function getStoredDateField(
  record: PublicInvoiceDoc,
  field: Exclude<PublicInvoiceDateField, "createdAt">,
) {
  switch (field) {
    case "issueDate":
      return record.issueDate ?? null;
    case "sentAt":
      return record.sentAt ?? null;
    case "dueDate":
      return record.dueDate ?? null;
    case "paidAt":
      return record.paidAt ?? null;
  }
}

function getStoredDateFieldValue(
  record: PublicInvoiceDoc,
  field: PublicInvoiceDateField,
) {
  if (field === "createdAt") {
    return record.createdAt;
  }

  return getStoredDateField(record, field);
}

function normalizeDateBoundary(
  value: string | null | undefined,
  boundary: "start" | "end",
) {
  if (!value) {
    return null;
  }

  if (!DATE_ONLY_PATTERN.test(value)) {
    return value;
  }

  return boundary === "start"
    ? `${value}T00:00:00.000Z`
    : `${value}T23:59:59.999Z`;
}

function matchesDateRange(
  value: string | null | undefined,
  from: string | null,
  to: string | null,
) {
  if (!value) {
    return false;
  }

  return (!from || value >= from) && (!to || value <= to);
}

function isSamePublicInvoiceRecord(
  record: PublicInvoiceDoc,
  args: {
    invoiceId: string;
    token: string;
  },
  existing: PublicInvoiceDoc | null,
) {
  return (
    (existing !== null && record._id === existing._id) ||
    record.publicInvoiceId === args.invoiceId ||
    record.token === args.token
  );
}

async function getPublicInvoicesByStatuses(
  ctx: ReadCtx,
  teamId: TeamDoc["_id"],
  statuses: string[],
) {
  const records = await Promise.all(
    statuses.map((status) =>
      ctx.db
        .query("publicInvoices")
        .withIndex("by_team_status", (q) =>
          q.eq("teamId", teamId).eq("status", status),
        )
        .collect(),
    ),
  );

  return records.flat();
}

async function getPublicInvoicesByStatusAndCreatedAt(
  ctx: ReadCtx,
  teamId: TeamDoc["_id"],
  statuses: string[],
  from: string | null,
  to: string | null,
) {
  const records = await Promise.all(
    statuses.map((status) =>
      ctx.db
        .query("publicInvoices")
        .withIndex("by_team_status_created_at", (q) => {
          const range = q.eq("teamId", teamId).eq("status", status);

          if (from && to) {
            return range.gte("createdAt", from).lte("createdAt", to);
          }

          if (from) {
            return range.gte("createdAt", from);
          }

          if (to) {
            return range.lte("createdAt", to);
          }

          return range;
        })
        .collect(),
    ),
  );

  return records.flat();
}

async function getPublicInvoicesByCreatedAt(
  ctx: ReadCtx,
  teamId: TeamDoc["_id"],
  from: string | null,
  to: string | null,
) {
  return ctx.db
    .query("publicInvoices")
    .withIndex("by_team_created_at", (q) => {
      const range = q.eq("teamId", teamId);

      if (from && to) {
        return range.gte("createdAt", from).lte("createdAt", to);
      }

      if (from) {
        return range.gte("createdAt", from);
      }

      if (to) {
        return range.lte("createdAt", to);
      }

      return range;
    })
    .collect();
}

async function getPublicInvoicesByStatusAndDateField(
  ctx: ReadCtx,
  teamId: TeamDoc["_id"],
  statuses: string[],
  field: Exclude<PublicInvoiceDateField, "createdAt" | "sentAt">,
  from: string | null,
  to: string | null,
) {
  const records = await Promise.all(
    statuses.map((status) => {
      if (field === "issueDate") {
        return ctx.db
          .query("publicInvoices")
          .withIndex("by_team_status_issue_date", (q) => {
            const range = q.eq("teamId", teamId).eq("status", status);

            if (from && to) {
              return range.gte("issueDate", from).lte("issueDate", to);
            }

            if (from) {
              return range.gte("issueDate", from);
            }

            if (to) {
              return range.lte("issueDate", to);
            }

            return range;
          })
          .collect();
      }

      if (field === "dueDate") {
        return ctx.db
          .query("publicInvoices")
          .withIndex("by_team_status_due_date", (q) => {
            const range = q.eq("teamId", teamId).eq("status", status);

            if (from && to) {
              return range.gte("dueDate", from).lte("dueDate", to);
            }

            if (from) {
              return range.gte("dueDate", from);
            }

            if (to) {
              return range.lte("dueDate", to);
            }

            return range;
          })
          .collect();
      }

      return ctx.db
        .query("publicInvoices")
        .withIndex("by_team_status_paid_at", (q) => {
          const range = q.eq("teamId", teamId).eq("status", status);

          if (from && to) {
            return range.gte("paidAt", from).lte("paidAt", to);
          }

          if (from) {
            return range.gte("paidAt", from);
          }

          if (to) {
            return range.lte("paidAt", to);
          }

          return range;
        })
        .collect();
    }),
  );

  return records.flat();
}

async function getPublicInvoicesByTeamDateField(
  ctx: ReadCtx,
  teamId: TeamDoc["_id"],
  field: "issueDate" | "sentAt",
  from: string | null,
  to: string | null,
) {
  if (field === "issueDate") {
    return ctx.db
      .query("publicInvoices")
      .withIndex("by_team_issue_date", (q) => {
        const range = q.eq("teamId", teamId);

        if (from && to) {
          return range.gte("issueDate", from).lte("issueDate", to);
        }

        if (from) {
          return range.gte("issueDate", from);
        }

        if (to) {
          return range.lte("issueDate", to);
        }

        return range;
      })
      .collect();
  }

  return ctx.db
    .query("publicInvoices")
    .withIndex("by_team_sent_at", (q) => {
      const range = q.eq("teamId", teamId);

      if (from && to) {
        return range.gte("sentAt", from).lte("sentAt", to);
      }

      if (from) {
        return range.gte("sentAt", from);
      }

      if (to) {
        return range.lte("sentAt", to);
      }

      return range;
    })
    .collect();
}

function serializePublicInvoice(record: {
  _id: string;
  publicInvoiceId?: string;
  token: string;
  status: string;
  paymentIntentId?: string;
  viewedAt?: string;
  invoiceNumber?: string;
  invoiceRecurringId?: string;
  recurringSequence?: number;
  payload: PublicInvoicePayload;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: record.publicInvoiceId ?? record._id,
    token: record.token,
    status: record.status,
    paymentIntentId: record.paymentIntentId ?? null,
    viewedAt: record.viewedAt ?? null,
    invoiceNumber: record.invoiceNumber ?? null,
    invoiceRecurringId: record.invoiceRecurringId ?? null,
    recurringSequence: record.recurringSequence ?? null,
    payload: record.payload,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function getPublicInvoiceForTeam(
  ctx: ReadCtx,
  args: {
    teamId: TeamDoc["_id"];
    invoiceId: string;
  },
) {
  const byPublicId = await ctx.db
    .query("publicInvoices")
    .withIndex("by_team_and_public_invoice_id", (q) =>
      q.eq("teamId", args.teamId).eq("publicInvoiceId", args.invoiceId),
    )
    .unique();

  if (byPublicId) {
    return byPublicId;
  }

  try {
    const byDocId = await ctx.db.get(args.invoiceId as Doc<"publicInvoices">["_id"]);

    if (byDocId && byDocId.teamId === args.teamId) {
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

export const serviceUpsertPublicInvoice = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceId: v.string(),
    token: v.string(),
    status: v.string(),
    paymentIntentId: v.optional(v.union(v.string(), v.null())),
    viewedAt: v.optional(v.union(v.string(), v.null())),
    invoiceNumber: v.optional(v.union(v.string(), v.null())),
    payload: v.any(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex public invoice team not found");
    }

    const timestamp = nowIso();
    const payload = args.payload as PublicInvoicePayload;
    const projectionFields = getPublicInvoiceProjectionFields(
      payload,
      args.invoiceNumber,
    );
    const invoiceNumber = projectionFields.invoiceNumber ?? null;
    const existing =
      (await ctx.db
        .query("publicInvoices")
        .withIndex("by_team_and_public_invoice_id", (q) =>
          q.eq("teamId", team._id).eq("publicInvoiceId", args.invoiceId),
        )
        .unique()) ??
      (await ctx.db
        .query("publicInvoices")
        .withIndex("by_token", (q) => q.eq("token", args.token))
        .unique());

    if (invoiceNumber) {
      const indexedMatches = await ctx.db
        .query("publicInvoices")
        .withIndex("by_team_and_invoice_number", (q) =>
          q.eq("teamId", team._id).eq("invoiceNumber", invoiceNumber),
        )
        .collect();
      const indexedConflict = indexedMatches.find(
        (record) => !isSamePublicInvoiceRecord(record, args, existing),
      );

      if (indexedConflict) {
        throw buildInvoiceNumberConflictError(invoiceNumber);
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        publicInvoiceId: existing.publicInvoiceId ?? args.invoiceId,
        teamId: team._id,
        token: args.token,
        status: args.status,
        paymentIntentId: args.paymentIntentId ?? undefined,
        viewedAt: args.viewedAt ?? undefined,
        ...projectionFields,
        payload,
        updatedAt: timestamp,
      });

      await advanceNextInvoiceSequenceIfNeeded(ctx, team, invoiceNumber);

      const updated = await ctx.db.get(existing._id);

      if (!updated) {
        throw new ConvexError("Failed to update public invoice projection");
      }

      return serializePublicInvoice({
        _id: updated._id,
        publicInvoiceId: updated.publicInvoiceId,
        token: updated.token,
        status: updated.status,
        paymentIntentId: updated.paymentIntentId,
        viewedAt: updated.viewedAt,
        invoiceNumber: updated.invoiceNumber,
        invoiceRecurringId: updated.invoiceRecurringId,
        recurringSequence: updated.recurringSequence,
        payload: updated.payload as PublicInvoicePayload,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    }

    const insertedId = await ctx.db.insert("publicInvoices", {
      publicInvoiceId: args.invoiceId,
      teamId: team._id,
      token: args.token,
      status: args.status,
      paymentIntentId: args.paymentIntentId ?? undefined,
      viewedAt: args.viewedAt ?? undefined,
      ...projectionFields,
      payload,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await advanceNextInvoiceSequenceIfNeeded(ctx, team, invoiceNumber);

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create public invoice projection");
    }

    return serializePublicInvoice({
      _id: inserted._id,
      publicInvoiceId: inserted.publicInvoiceId,
      token: inserted.token,
      status: inserted.status,
      paymentIntentId: inserted.paymentIntentId,
      viewedAt: inserted.viewedAt,
      invoiceNumber: inserted.invoiceNumber,
      invoiceRecurringId: inserted.invoiceRecurringId,
      recurringSequence: inserted.recurringSequence,
      payload: inserted.payload as PublicInvoicePayload,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    });
  },
});

export const serviceGetPublicInvoiceByPublicInvoiceId = query({
  args: {
    serviceKey: v.string(),
    publicInvoiceId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = await ctx.db
      .query("publicInvoices")
      .withIndex("by_public_invoice_id", (q) =>
        q.eq("publicInvoiceId", args.publicInvoiceId),
      )
      .unique();

    if (!record) {
      return null;
    }

    return serializePublicInvoice({
      _id: record._id,
      publicInvoiceId: record.publicInvoiceId,
      token: record.token,
      status: record.status,
      paymentIntentId: record.paymentIntentId,
      viewedAt: record.viewedAt,
      invoiceNumber: record.invoiceNumber,
      payload: record.payload as PublicInvoicePayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});

export const serviceGetPublicInvoiceByToken = query({
  args: {
    serviceKey: v.string(),
    token: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = await ctx.db
      .query("publicInvoices")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!record) {
      return null;
    }

    return serializePublicInvoice({
      _id: record._id,
      publicInvoiceId: record.publicInvoiceId,
      token: record.token,
      status: record.status,
      paymentIntentId: record.paymentIntentId,
      viewedAt: record.viewedAt,
      invoiceNumber: record.invoiceNumber,
      payload: record.payload as PublicInvoicePayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});

export const serviceGetPublicInvoiceByInvoiceNumber = query({
  args: {
    serviceKey: v.string(),
    invoiceNumber: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = sortByNewestCreatedAt(
      await ctx.db
        .query("publicInvoices")
        .withIndex("by_invoice_number", (q) =>
          q.eq("invoiceNumber", args.invoiceNumber),
        )
        .collect(),
    )[0];

    if (!record) {
      return null;
    }

    return serializePublicInvoice({
      _id: record._id,
      publicInvoiceId: record.publicInvoiceId,
      token: record.token,
      status: record.status,
      paymentIntentId: record.paymentIntentId,
      viewedAt: record.viewedAt,
      invoiceNumber: record.invoiceNumber,
      payload: record.payload as PublicInvoicePayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});

export const serviceGetPublicInvoiceByTeamAndInvoiceNumber = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceNumber: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const indexedRecord = sortByNewestCreatedAt(
      await ctx.db
        .query("publicInvoices")
        .withIndex("by_team_and_invoice_number", (q) =>
          q.eq("teamId", team._id).eq("invoiceNumber", args.invoiceNumber),
        )
        .collect(),
    )[0];
    const record = indexedRecord;

    if (!record) {
      return null;
    }

    return serializePublicInvoice({
      _id: record._id,
      publicInvoiceId: record.publicInvoiceId,
      token: record.token,
      status: record.status,
      paymentIntentId: record.paymentIntentId,
      viewedAt: record.viewedAt,
      invoiceNumber: record.invoiceNumber,
      payload: record.payload as PublicInvoicePayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});

export const serviceGetPublicInvoiceByRecurringSequence = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceRecurringId: v.string(),
    recurringSequence: v.number(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const indexedRecord = sortByNewestCreatedAt(
      await ctx.db
        .query("publicInvoices")
        .withIndex("by_team_invoice_recurring_sequence", (q) =>
          q
            .eq("teamId", team._id)
            .eq("invoiceRecurringId", args.invoiceRecurringId)
            .eq("recurringSequence", args.recurringSequence),
        )
        .collect(),
    )[0];
    const record = indexedRecord;

    if (!record) {
      return null;
    }

    return serializePublicInvoice({
      _id: record._id,
      publicInvoiceId: record.publicInvoiceId,
      token: record.token,
      status: record.status,
      paymentIntentId: record.paymentIntentId,
      viewedAt: record.viewedAt,
      invoiceNumber: record.invoiceNumber,
      invoiceRecurringId: record.invoiceRecurringId,
      recurringSequence: record.recurringSequence,
      payload: record.payload as PublicInvoicePayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});

export const serviceGetPublicInvoicesByRecurringId = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceRecurringId: v.string(),
    statuses: v.optional(v.array(v.string())),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = sortByRecurringSequence(
      await ctx.db
        .query("publicInvoices")
        .withIndex("by_team_and_invoice_recurring_id", (q) =>
          q
            .eq("teamId", team._id)
            .eq("invoiceRecurringId", args.invoiceRecurringId),
        )
        .collect(),
    ).filter((record) =>
      args.statuses ? args.statuses.includes(record.status) : true,
    );

    return records.map((record) =>
      serializePublicInvoice({
        _id: record._id,
        publicInvoiceId: record.publicInvoiceId,
        token: record.token,
        status: record.status,
        paymentIntentId: record.paymentIntentId,
        viewedAt: record.viewedAt,
        invoiceNumber: record.invoiceNumber,
        invoiceRecurringId: record.invoiceRecurringId,
        recurringSequence: record.recurringSequence,
        payload: record.payload as PublicInvoicePayload,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }),
    );
  },
});

export const serviceGetNextInvoiceNumberPreview = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex public invoice team not found");
    }

    const nextSequence =
      typeof team.nextInvoiceSequence === "number"
        ? team.nextInvoiceSequence
        : await getNextInvoiceSequencePreview(ctx, team._id);

    return formatInvoiceNumber(nextSequence);
  },
});

export const serviceAllocateNextInvoiceNumber = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex public invoice team not found");
    }

    const nextSequence = await getNextInvoiceSequence(ctx, team);

    await ctx.db.patch(team._id, {
      nextInvoiceSequence: nextSequence + 1,
    });

    return formatInvoiceNumber(nextSequence);
  },
});

export const serviceGetPublicInvoicesByTeam = query({
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
      .query("publicInvoices")
      .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
      .collect();

    return records.map((record) =>
      serializePublicInvoice({
        _id: record._id,
        publicInvoiceId: record.publicInvoiceId,
        token: record.token,
        status: record.status,
        paymentIntentId: record.paymentIntentId,
        viewedAt: record.viewedAt,
        invoiceNumber: record.invoiceNumber,
        payload: record.payload as PublicInvoicePayload,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }),
    );
  },
});

export const serviceGetPublicInvoicesByCustomerIds = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    customerIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.customerIds.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = await Promise.all(
      [...new Set(args.customerIds)].map((customerId) =>
        ctx.db
          .query("publicInvoices")
          .withIndex("by_team_and_customer", (q) =>
            q.eq("teamId", team._id).eq("customerId", customerId),
          )
          .collect(),
      ),
    );

    return records.flat().map((record) =>
      serializePublicInvoice({
        _id: record._id,
        publicInvoiceId: record.publicInvoiceId,
        token: record.token,
        status: record.status,
        paymentIntentId: record.paymentIntentId,
        viewedAt: record.viewedAt,
        invoiceNumber: record.invoiceNumber,
        invoiceRecurringId: record.invoiceRecurringId,
        recurringSequence: record.recurringSequence,
        payload: record.payload as PublicInvoicePayload,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }),
    );
  },
});

export const serviceGetPublicInvoicesByIds = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceIds: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    if (args.invoiceIds.length === 0) {
      return [];
    }

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const records = await Promise.all(
      [...new Set(args.invoiceIds)].map((invoiceId) =>
        getPublicInvoiceForTeam(ctx, {
          teamId: team._id,
          invoiceId,
        }),
      ),
    );

    return records
      .filter((record): record is PublicInvoiceDoc => record !== null)
      .map((record) =>
        serializePublicInvoice({
          _id: record._id,
          publicInvoiceId: record.publicInvoiceId,
          token: record.token,
          status: record.status,
          paymentIntentId: record.paymentIntentId,
          viewedAt: record.viewedAt,
          invoiceNumber: record.invoiceNumber,
          invoiceRecurringId: record.invoiceRecurringId,
          recurringSequence: record.recurringSequence,
          payload: record.payload as PublicInvoicePayload,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        }),
      );
  },
});

export const serviceListPublicInvoicesPage = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    status: v.optional(v.string()),
    order: v.optional(publicInvoiceOrderValidator),
    createdAtFrom: v.optional(v.string()),
    createdAtTo: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return {
        page: [],
        isDone: true,
        continueCursor: args.paginationOpts.cursor ?? "",
        splitCursor: null,
        pageStatus: null,
      };
    }

    const db = ctx.db as any;
    const baseQuery = args.status
      ? ctx.db
          .query("publicInvoices")
          .withIndex("by_team_status_created_at", (q) => {
            const range = q.eq("teamId", team._id).eq("status", args.status!);

            if (args.createdAtFrom && args.createdAtTo) {
              return range
                .gte("createdAt", args.createdAtFrom)
                .lte("createdAt", args.createdAtTo);
            }

            if (args.createdAtFrom) {
              return range.gte("createdAt", args.createdAtFrom);
            }

            if (args.createdAtTo) {
              return range.lte("createdAt", args.createdAtTo);
            }

            return range;
          })
      : db
          .query("publicInvoices")
          .withIndex("by_team_created_at", (q: any) => {
            const range = q.eq("teamId", team._id);

            if (args.createdAtFrom && args.createdAtTo) {
              return range
                .gte("createdAt", args.createdAtFrom)
                .lte("createdAt", args.createdAtTo);
            }

            if (args.createdAtFrom) {
              return range.gte("createdAt", args.createdAtFrom);
            }

            if (args.createdAtTo) {
              return range.lte("createdAt", args.createdAtTo);
            }

            return range;
          });

    const orderedQuery = baseQuery.order(args.order ?? "desc");
    const result = await orderedQuery.paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.map((record: PublicInvoiceDoc) =>
        serializePublicInvoice({
          _id: record._id,
          publicInvoiceId: record.publicInvoiceId,
          token: record.token,
          status: record.status,
          paymentIntentId: record.paymentIntentId,
          viewedAt: record.viewedAt,
          invoiceNumber: record.invoiceNumber,
          invoiceRecurringId: record.invoiceRecurringId,
          recurringSequence: record.recurringSequence,
          payload: record.payload as PublicInvoicePayload,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        }),
      ),
    };
  },
});

export const serviceGetPublicInvoicesByFilters = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    statuses: v.optional(v.array(v.string())),
    currency: v.optional(v.string()),
    dateField: v.optional(publicInvoiceDateFieldValidator),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const statuses =
      args.statuses && args.statuses.length > 0 ? args.statuses : null;
    const dateField = args.dateField ?? null;
    const from = normalizeDateBoundary(args.from, "start");
    const to = normalizeDateBoundary(args.to, "end");

    let records: PublicInvoiceDoc[];

    if (statuses && dateField === "createdAt") {
      records = await getPublicInvoicesByStatusAndCreatedAt(
        ctx,
        team._id,
        statuses,
        from,
        to,
      );
    } else if (!statuses && dateField === "createdAt") {
      records = await getPublicInvoicesByCreatedAt(
        ctx,
        team._id,
        from,
        to,
      );
    } else if (
      statuses &&
      dateField &&
      dateField !== "createdAt" &&
      dateField !== "sentAt"
    ) {
      records = await getPublicInvoicesByStatusAndDateField(
        ctx,
        team._id,
        statuses,
        dateField,
        from,
        to,
      );
    } else if (!statuses && dateField && dateField !== "createdAt" && dateField !== "dueDate" && dateField !== "paidAt") {
      records = await getPublicInvoicesByTeamDateField(
        ctx,
        team._id,
        dateField,
        from,
        to,
      );
    } else if (statuses) {
      records = await getPublicInvoicesByStatuses(ctx, team._id, statuses);
    } else {
      records = await ctx.db
        .query("publicInvoices")
        .withIndex("by_team_id", (q) => q.eq("teamId", team._id))
        .collect();
    }

    const filteredRecords = records.filter((record) => {
      if (statuses && !statuses.includes(record.status)) {
        return false;
      }

      if (dateField) {
        const dateValue = getStoredDateFieldValue(record, dateField);

        if (!matchesDateRange(dateValue, from, to)) {
          return false;
        }
      }

      if (args.currency && record.currency !== args.currency) {
        return false;
      }

      return true;
    });

    return filteredRecords.map((record) =>
      serializePublicInvoice({
        _id: record._id,
        publicInvoiceId: record.publicInvoiceId,
        token: record.token,
        status: record.status,
        paymentIntentId: record.paymentIntentId,
        viewedAt: record.viewedAt,
        invoiceNumber: record.invoiceNumber,
        invoiceRecurringId: record.invoiceRecurringId,
        recurringSequence: record.recurringSequence,
        payload: record.payload as PublicInvoicePayload,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }),
    );
  },
});

export const serviceGetPublicInvoicesByStatuses = query({
  args: {
    serviceKey: v.string(),
    statuses: v.array(v.string()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const records = await Promise.all(
      args.statuses.map((status) =>
        ctx.db
          .query("publicInvoices")
          .withIndex("by_status", (q) => q.eq("status", status))
          .collect(),
      ),
    );

    return records.flat().map((record) =>
      serializePublicInvoice({
        _id: record._id,
        publicInvoiceId: record.publicInvoiceId,
        token: record.token,
        status: record.status,
        paymentIntentId: record.paymentIntentId,
        viewedAt: record.viewedAt,
        invoiceNumber: record.invoiceNumber,
        payload: record.payload as PublicInvoicePayload,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }),
    );
  },
});

export const serviceGetPublicInvoiceByPaymentIntentId = query({
  args: {
    serviceKey: v.string(),
    paymentIntentId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const record = await ctx.db
      .query("publicInvoices")
      .withIndex("by_payment_intent_id", (q) =>
        q.eq("paymentIntentId", args.paymentIntentId),
      )
      .unique();

    if (!record) {
      return null;
    }

    return serializePublicInvoice({
      _id: record._id,
      publicInvoiceId: record.publicInvoiceId,
      token: record.token,
      status: record.status,
      paymentIntentId: record.paymentIntentId,
      viewedAt: record.viewedAt,
      invoiceNumber: record.invoiceNumber,
      payload: record.payload as PublicInvoicePayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});

export const serviceDeletePublicInvoice = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamByPublicTeamId(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const record = await ctx.db
      .query("publicInvoices")
      .withIndex("by_team_and_public_invoice_id", (q) =>
        q.eq("teamId", team._id).eq("publicInvoiceId", args.invoiceId),
      )
      .unique();

    if (!record) {
      return null;
    }

    await ctx.db.delete(record._id);

    return serializePublicInvoice({
      _id: record._id,
      publicInvoiceId: record.publicInvoiceId,
      token: record.token,
      status: record.status,
      paymentIntentId: record.paymentIntentId,
      viewedAt: record.viewedAt,
      invoiceNumber: record.invoiceNumber,
      payload: record.payload as PublicInvoicePayload,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  },
});
