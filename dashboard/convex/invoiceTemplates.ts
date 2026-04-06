import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getTeamByPublicTeamId } from "./lib/identity";
import { requireServiceKey } from "./lib/service";
import { nowIso } from "../../packages/domain/src/identity";

type InvoiceTemplateCtx = QueryCtx | MutationCtx;

type InvoiceTemplateData = Record<string, unknown>;

function serializeInvoiceTemplate(
  record: Doc<"invoiceTemplates">,
): Record<string, unknown> {
  return {
    id: record.publicInvoiceTemplateId ?? record._id,
    name: record.name,
    isDefault: record.isDefault,
    ...(record.data ?? {}),
  };
}

async function getTeamOrNull(ctx: InvoiceTemplateCtx, publicTeamId: string) {
  return getTeamByPublicTeamId(ctx, publicTeamId);
}

async function getTemplateRecordForTeam(
  ctx: InvoiceTemplateCtx,
  publicTeamId: string,
  invoiceTemplateId: string,
) {
  const [team, record] = await Promise.all([
    getTeamOrNull(ctx, publicTeamId),
    ctx.db
      .query("invoiceTemplates")
      .withIndex("by_public_invoice_template_id", (q) =>
        q.eq("publicInvoiceTemplateId", invoiceTemplateId),
      )
      .unique(),
  ]);

  if (!team || !record || record.teamId !== team._id) {
    return { team: null, record: null };
  }

  return { team, record };
}

async function listTemplatesForTeam(
  ctx: InvoiceTemplateCtx,
  teamId: Id<"teams">,
) {
  return ctx.db
    .query("invoiceTemplates")
    .withIndex("by_team_id", (q) => q.eq("teamId", teamId))
    .collect();
}

async function getDefaultTemplateForTeam(
  ctx: InvoiceTemplateCtx,
  teamId: Id<"teams">,
) {
  return ctx.db
    .query("invoiceTemplates")
    .withIndex("by_team_default", (q) =>
      q.eq("teamId", teamId).eq("isDefault", true),
    )
    .unique();
}

async function unsetDefaultsForTeam(
  ctx: MutationCtx,
  teamId: Id<"teams">,
  ignoreRecordId?: Id<"invoiceTemplates">,
) {
  const existingDefaults = await ctx.db
    .query("invoiceTemplates")
    .withIndex("by_team_default", (q) =>
      q.eq("teamId", teamId).eq("isDefault", true),
    )
    .collect();

  for (const record of existingDefaults) {
    if (ignoreRecordId && record._id === ignoreRecordId) {
      continue;
    }

    await ctx.db.patch(record._id, {
      isDefault: false,
      updatedAt: nowIso(),
    });
  }
}

function sortTemplates(records: Doc<"invoiceTemplates">[]) {
  return [...records].sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

export const serviceGetInvoiceTemplates = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrNull(ctx, args.publicTeamId);

    if (!team) {
      return [];
    }

    const templates = await listTemplatesForTeam(ctx, team._id);
    return sortTemplates(templates).map(serializeInvoiceTemplate);
  },
});

export const serviceGetInvoiceTemplateById = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceTemplateId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const { record } = await getTemplateRecordForTeam(
      ctx,
      args.publicTeamId,
      args.invoiceTemplateId,
    );

    return record ? serializeInvoiceTemplate(record) : null;
  },
});

export const serviceGetInvoiceTemplate = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrNull(ctx, args.publicTeamId);

    if (!team) {
      return null;
    }

    const defaultTemplate = await getDefaultTemplateForTeam(ctx, team._id);

    if (defaultTemplate) {
      return serializeInvoiceTemplate(defaultTemplate);
    }

    const templates = await listTemplatesForTeam(ctx, team._id);
    const firstTemplate = [...templates].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    )[0];

    return firstTemplate ? serializeInvoiceTemplate(firstTemplate) : null;
  },
});

export const serviceCreateInvoiceTemplate = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    name: v.string(),
    isDefault: v.optional(v.boolean()),
    templateData: v.optional(v.any()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrNull(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex invoice template team not found");
    }

    const existingTemplates = await listTemplatesForTeam(ctx, team._id);
    const isFirstTemplate = existingTemplates.length === 0;
    const shouldBeDefault = isFirstTemplate || (args.isDefault ?? false);

    if (shouldBeDefault) {
      await unsetDefaultsForTeam(ctx, team._id);
    }

    const timestamp = nowIso();
    const insertedId = await ctx.db.insert("invoiceTemplates", {
      publicInvoiceTemplateId: crypto.randomUUID(),
      teamId: team._id,
      name: args.name,
      isDefault: shouldBeDefault,
      data: (args.templateData ?? {}) as InvoiceTemplateData,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const inserted = await ctx.db.get(insertedId);

    if (!inserted) {
      throw new ConvexError("Failed to create invoice template");
    }

    return serializeInvoiceTemplate(inserted);
  },
});

export const serviceUpsertInvoiceTemplate = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceTemplateId: v.optional(v.string()),
    name: v.optional(v.string()),
    templateData: v.optional(v.any()),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrNull(ctx, args.publicTeamId);

    if (!team) {
      throw new ConvexError("Convex invoice template team not found");
    }

    const timestamp = nowIso();

    if (args.invoiceTemplateId) {
      const { record } = await getTemplateRecordForTeam(
        ctx,
        args.publicTeamId,
        args.invoiceTemplateId,
      );

      if (!record) {
        throw new ConvexError("Template not found");
      }

      await ctx.db.patch(record._id, {
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.templateData !== undefined
          ? {
              data: {
                ...(record.data ?? {}),
                ...(args.templateData as InvoiceTemplateData),
              },
            }
          : {}),
        updatedAt: timestamp,
      });

      const updated = await ctx.db.get(record._id);

      if (!updated) {
        throw new ConvexError("Failed to update invoice template");
      }

      return serializeInvoiceTemplate(updated);
    }

    const defaultTemplate = await getDefaultTemplateForTeam(ctx, team._id);

    if (defaultTemplate) {
      await ctx.db.patch(defaultTemplate._id, {
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.templateData !== undefined
          ? {
              data: {
                ...(defaultTemplate.data ?? {}),
                ...(args.templateData as InvoiceTemplateData),
              },
            }
          : {}),
        updatedAt: timestamp,
      });

      const updated = await ctx.db.get(defaultTemplate._id);

      if (!updated) {
        throw new ConvexError("Failed to update invoice template");
      }

      return serializeInvoiceTemplate(updated);
    }

    const templates = await listTemplatesForTeam(ctx, team._id);
    const firstTemplate = [...templates].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    )[0];

    if (firstTemplate) {
      await ctx.db.patch(firstTemplate._id, {
        ...(args.name !== undefined ? { name: args.name } : {}),
        ...(args.templateData !== undefined
          ? {
              data: {
                ...(firstTemplate.data ?? {}),
                ...(args.templateData as InvoiceTemplateData),
              },
            }
          : {}),
        updatedAt: timestamp,
      });

      const updated = await ctx.db.get(firstTemplate._id);

      if (!updated) {
        throw new ConvexError("Failed to update invoice template");
      }

      return serializeInvoiceTemplate(updated);
    }

    const createdId = await ctx.db.insert("invoiceTemplates", {
      publicInvoiceTemplateId: crypto.randomUUID(),
      teamId: team._id,
      name: args.name ?? "Default",
      isDefault: true,
      data: (args.templateData ?? {}) as InvoiceTemplateData,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const created = await ctx.db.get(createdId);

    if (!created) {
      throw new ConvexError("Failed to create invoice template");
    }

    return serializeInvoiceTemplate(created);
  },
});

export const serviceSetDefaultInvoiceTemplate = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceTemplateId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const { team, record } = await getTemplateRecordForTeam(
      ctx,
      args.publicTeamId,
      args.invoiceTemplateId,
    );

    if (!team || !record) {
      throw new ConvexError("Template not found");
    }

    await unsetDefaultsForTeam(ctx, team._id, record._id);

    await ctx.db.patch(record._id, {
      isDefault: true,
      updatedAt: nowIso(),
    });

    const updated = await ctx.db.get(record._id);

    if (!updated) {
      throw new ConvexError("Failed to set default invoice template");
    }

    return serializeInvoiceTemplate(updated);
  },
});

export const serviceDeleteInvoiceTemplate = mutation({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
    invoiceTemplateId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const { team, record } = await getTemplateRecordForTeam(
      ctx,
      args.publicTeamId,
      args.invoiceTemplateId,
    );

    if (!team || !record) {
      throw new ConvexError("Template not found");
    }

    const templates = await listTemplatesForTeam(ctx, team._id);
    const remaining = templates.filter((template) => template._id !== record._id);

    if (remaining.length === 0) {
      throw new ConvexError("Cannot delete the last template");
    }

    await ctx.db.delete(record._id);

    let newDefault: Record<string, unknown> | null = null;

    if (record.isDefault) {
      const nextDefault = [...remaining].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      )[0];

      if (nextDefault) {
        await unsetDefaultsForTeam(ctx, team._id, nextDefault._id);
        await ctx.db.patch(nextDefault._id, {
          isDefault: true,
          updatedAt: nowIso(),
        });

        const updatedDefault = await ctx.db.get(nextDefault._id);
        newDefault = updatedDefault ? serializeInvoiceTemplate(updatedDefault) : null;
      }
    } else {
      const currentDefault = remaining.find((template) => template.isDefault) ?? null;
      newDefault = currentDefault ? serializeInvoiceTemplate(currentDefault) : null;
    }

    return {
      deleted: serializeInvoiceTemplate(record),
      newDefault,
    };
  },
});

export const serviceGetInvoiceTemplateCount = query({
  args: {
    serviceKey: v.string(),
    publicTeamId: v.string(),
  },
  async handler(ctx, args) {
    requireServiceKey(args.serviceKey);

    const team = await getTeamOrNull(ctx, args.publicTeamId);

    if (!team) {
      return 0;
    }

    const templates = await listTemplatesForTeam(ctx, team._id);
    return templates.length;
  },
});
