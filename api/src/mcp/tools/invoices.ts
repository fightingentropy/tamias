import {
  allocateNextInvoiceNumber,
  beginIdempotentOperation,
  completeIdempotentOperation,
  deleteInvoice,
  duplicateInvoice,
  failIdempotentOperation,
  requireIdempotentOperationReconciliation,
  updateInvoice,
} from "@tamias/app-data/queries";
import {
  getInvoiceByIdForTeam,
  getInvoiceSummaryForTeam,
  getInvoicesPage,
} from "@tamias/app-services/invoices";
import { z } from "zod";
import {
  deleteInvoiceSchema,
  duplicateInvoiceSchema,
  getInvoiceByIdSchema,
  getInvoicesSchema,
  invoiceSummarySchema,
  updateInvoiceSchema,
} from "../../schemas/invoice";
import { hasScope, READ_ONLY_ANNOTATIONS, type RegisterTools } from "../types";

// Annotations for write operations
const WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function confirmedMutationShape<Confirmation extends string>(confirmation: Confirmation) {
  return {
    idempotencyKey: z
      .string()
      .min(8)
      .max(200)
      .regex(/^[A-Za-z0-9._:-]+$/)
      .describe("Stable key reused unchanged when retrying this exact mutation"),
    confirmationId: z
      .string()
      .uuid()
      .describe("Identifier from the human confirmation shown before this mutation"),
    confirmation: z.literal(confirmation).describe(`Must be exactly ${confirmation}`),
  };
}

// Annotations for destructive operations
const DESTRUCTIVE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const registerInvoiceTools: RegisterTools = (server, ctx) => {
  const { db, teamId, userId } = ctx;

  // Check scopes
  const hasReadScope = hasScope(ctx, "invoices.read");
  const hasWriteScope = hasScope(ctx, "invoices.write");

  async function runConfirmedMutation<Result>(args: {
    action: string;
    resourceId: string;
    idempotencyKey: string;
    confirmationId: string;
    request: Record<string, unknown>;
    mutate: () => Promise<Result>;
  }): Promise<Result> {
    if (!userId) {
      throw new Error("A user identity is required for MCP mutations");
    }

    const operation = await beginIdempotentOperation(db, {
      teamId,
      scope: `mcp.${args.action}`,
      idempotencyKey: args.idempotencyKey,
      request: args.request,
    });
    if (operation.state === "replayed") {
      return operation.result as Result;
    }

    let mutationCompleted = false;
    try {
      const result = await args.mutate();
      mutationCompleted = true;
      await completeIdempotentOperation(db, {
        teamId,
        scope: `mcp.${args.action}`,
        idempotencyKey: args.idempotencyKey,
        leaseToken: operation.leaseToken,
        result,
        audit: {
          actorType: "mcp",
          actorId: userId,
          action: `mcp.${args.action}`,
          resourceType: "invoice",
          resourceId: args.resourceId,
          confirmationId: args.confirmationId,
          environment: process.env.TAMIAS_ENVIRONMENT ?? "unknown",
          payload: args.request,
        },
        outbox: {
          topic: `mcp.${args.action}`,
          aggregateType: "invoice",
          aggregateId: args.resourceId,
          payload: { actorId: userId },
        },
      });
      return result;
    } catch (error) {
      if (mutationCompleted) {
        await requireIdempotentOperationReconciliation(db, {
          teamId,
          scope: `mcp.${args.action}`,
          idempotencyKey: args.idempotencyKey,
          leaseToken: operation.leaseToken,
          error,
          providerResult: { resourceId: args.resourceId },
        });
      } else {
        await failIdempotentOperation(db, {
          teamId,
          scope: `mcp.${args.action}`,
          idempotencyKey: args.idempotencyKey,
          leaseToken: operation.leaseToken,
          error,
        });
      }
      throw error;
    }
  }

  // Skip if user has no invoice scopes
  if (!hasReadScope && !hasWriteScope) {
    return;
  }

  // ==========================================
  // READ TOOLS
  // ==========================================

  if (hasReadScope) {
    server.registerTool(
      "invoices_list",
      {
        title: "List Invoices",
        description:
          "List invoices with filtering by status, customer, date range, and search. Use this to find invoices.",
        inputSchema: getInvoicesSchema.shape,
        annotations: READ_ONLY_ANNOTATIONS,
      },
      async (params) => {
        const result = await getInvoicesPage({
          db,
          teamId,
          input: {
            cursor: params.cursor ?? null,
            pageSize: params.pageSize ?? 25,
            q: params.q ?? null,
            start: params.start ?? null,
            end: params.end ?? null,
            statuses: params.statuses ?? null,
            customers: params.customers ?? null,
            sort: params.sort ?? null,
          },
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      },
    );

    server.registerTool(
      "invoices_get",
      {
        title: "Get Invoice",
        description: "Get a specific invoice by its ID with full details",
        inputSchema: {
          id: getInvoiceByIdSchema.shape.id,
        },
        annotations: READ_ONLY_ANNOTATIONS,
      },
      async ({ id }) => {
        const result = await getInvoiceByIdForTeam({
          db,
          teamId,
          input: { id },
        });

        if (!result) {
          return {
            content: [{ type: "text", text: "Invoice not found" }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      },
    );

    server.registerTool(
      "invoices_summary",
      {
        title: "Invoice Summary",
        description: "Get a summary of invoices including total amounts and counts by status",
        inputSchema: invoiceSummarySchema.shape,
        annotations: READ_ONLY_ANNOTATIONS,
      },
      async (params) => {
        const result = await getInvoiceSummaryForTeam({
          db,
          teamId,
          input: { statuses: params.statuses },
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      },
    );
  }

  // ==========================================
  // WRITE TOOLS
  // ==========================================

  if (hasWriteScope) {
    server.registerTool(
      "invoices_update",
      {
        title: "Update Invoice",
        description:
          "Update an invoice after explicit human confirmation. Reuse the idempotency key for retries.",
        inputSchema: {
          id: updateInvoiceSchema.shape.id,
          status: z
            .enum(["paid", "canceled", "unpaid"])
            .optional()
            .describe("New status for the invoice"),
          paidAt: z
            .string()
            .datetime()
            .nullable()
            .optional()
            .describe("Payment date in ISO 8601 format (required when marking as paid)"),
          internalNote: z
            .string()
            .nullable()
            .optional()
            .describe("Internal note visible only to your team"),
          ...confirmedMutationShape("CONFIRM_UPDATE_INVOICE"),
        },
        annotations: WRITE_ANNOTATIONS,
      },
      async (params) => {
        // Check if invoice exists
        const existing = await getInvoiceByIdForTeam({
          db,
          teamId,
          input: { id: params.id },
        });

        if (!existing) {
          return {
            content: [{ type: "text", text: "Invoice not found" }],
            isError: true,
          };
        }

        const result = await runConfirmedMutation({
          action: "invoice.update",
          resourceId: params.id,
          idempotencyKey: params.idempotencyKey,
          confirmationId: params.confirmationId,
          request: {
            id: params.id,
            status: params.status,
            paidAt: params.paidAt,
            internalNote: params.internalNote,
          },
          mutate: () =>
            updateInvoice(db, {
              id: params.id,
              teamId,
              status: params.status,
              paidAt: params.paidAt,
              internalNote: params.internalNote,
              userId,
            }),
        });

        if (!result) {
          return {
            content: [{ type: "text", text: "Failed to update invoice" }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      },
    );

    server.registerTool(
      "invoices_mark_paid",
      {
        title: "Mark Invoice as Paid",
        description:
          "Mark an invoice as paid after explicit human confirmation. This does not initiate a bank payment.",
        inputSchema: {
          id: z.string().uuid().describe("The ID of the invoice to mark paid"),
          paidAt: z
            .string()
            .datetime()
            .optional()
            .describe("Payment date in ISO 8601 format (defaults to current time)"),
          ...confirmedMutationShape("CONFIRM_MARK_INVOICE_PAID"),
        },
        annotations: WRITE_ANNOTATIONS,
      },
      async (params) => {
        const existing = await getInvoiceByIdForTeam({
          db,
          teamId,
          input: { id: params.id },
        });

        if (!existing) {
          return {
            content: [{ type: "text", text: "Invoice not found" }],
            isError: true,
          };
        }

        if (existing.status === "paid") {
          return {
            content: [{ type: "text", text: "Invoice is already marked paid" }],
            isError: true,
          };
        }

        const paidAt = params.paidAt ?? new Date().toISOString();
        const result = await runConfirmedMutation({
          action: "invoice.mark_paid",
          resourceId: params.id,
          idempotencyKey: params.idempotencyKey,
          confirmationId: params.confirmationId,
          request: { id: params.id, paidAt },
          mutate: () =>
            updateInvoice(db, {
              id: params.id,
              teamId,
              status: "paid",
              paidAt,
              userId,
            }),
        });

        if (!result) {
          return {
            content: [{ type: "text", text: "Failed to mark invoice as paid" }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      },
    );

    server.registerTool(
      "invoices_delete",
      {
        title: "Delete Invoice",
        description: "Delete an invoice. Only draft or canceled invoices can be deleted.",
        inputSchema: {
          id: deleteInvoiceSchema.shape.id,
          ...confirmedMutationShape("CONFIRM_DELETE_INVOICE"),
        },
        annotations: DESTRUCTIVE_ANNOTATIONS,
      },
      async ({ id, idempotencyKey, confirmationId }) => {
        // Check invoice exists and status
        const existing = await getInvoiceByIdForTeam({
          db,
          teamId,
          input: { id },
        });

        if (!existing) {
          return {
            content: [{ type: "text", text: "Invoice not found" }],
            isError: true,
          };
        }

        if (existing.status !== "draft" && existing.status !== "canceled") {
          return {
            content: [
              {
                type: "text",
                text: `Cannot delete invoice with status "${existing.status}". Only draft or canceled invoices can be deleted.`,
              },
            ],
            isError: true,
          };
        }

        const result = await runConfirmedMutation({
          action: "invoice.delete",
          resourceId: id,
          idempotencyKey,
          confirmationId,
          request: { id },
          mutate: () => deleteInvoice(db, { id, teamId }),
        });

        if (!result) {
          return {
            content: [{ type: "text", text: "Failed to delete invoice" }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, deletedId: result.id }, null, 2),
            },
          ],
        };
      },
    );

    server.registerTool(
      "invoices_duplicate",
      {
        title: "Duplicate Invoice",
        description:
          "Create a copy of an existing invoice with a new invoice number and current date.",
        inputSchema: {
          id: duplicateInvoiceSchema.shape.id,
          ...confirmedMutationShape("CONFIRM_DUPLICATE_INVOICE"),
        },
        annotations: WRITE_ANNOTATIONS,
      },
      async ({ id, idempotencyKey, confirmationId }) => {
        // Check invoice exists
        const existing = await getInvoiceByIdForTeam({
          db,
          teamId,
          input: { id },
        });

        if (!existing) {
          return {
            content: [{ type: "text", text: "Invoice not found" }],
            isError: true,
          };
        }

        try {
          if (!userId) {
            return {
              content: [{ type: "text", text: "Missing user id" }],
              isError: true,
            };
          }

          const invoiceNumber = await allocateNextInvoiceNumber(db, teamId);

          const result = await runConfirmedMutation({
            action: "invoice.duplicate",
            resourceId: id,
            idempotencyKey,
            confirmationId,
            request: { id, invoiceNumber },
            mutate: () =>
              duplicateInvoice(db, {
                id,
                teamId,
                userId,
                invoiceNumber,
              }),
          });

          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: error instanceof Error ? error.message : "Failed to duplicate invoice",
              },
            ],
            isError: true,
          };
        }
      },
    );

    server.registerTool(
      "invoices_cancel",
      {
        title: "Cancel Invoice",
        description:
          "Cancel an invoice. This marks the invoice as canceled and it can then be deleted if needed.",
        inputSchema: {
          id: z.string().uuid().describe("The ID of the invoice to cancel"),
          ...confirmedMutationShape("CONFIRM_CANCEL_INVOICE"),
        },
        annotations: WRITE_ANNOTATIONS,
      },
      async ({ id, idempotencyKey, confirmationId }) => {
        const existing = await getInvoiceByIdForTeam({
          db,
          teamId,
          input: { id },
        });

        if (!existing) {
          return {
            content: [{ type: "text", text: "Invoice not found" }],
            isError: true,
          };
        }

        if (existing.status === "canceled") {
          return {
            content: [{ type: "text", text: "Invoice is already canceled" }],
            isError: true,
          };
        }

        if (existing.status === "paid") {
          return {
            content: [{ type: "text", text: "Cannot cancel a paid invoice" }],
            isError: true,
          };
        }

        const result = await runConfirmedMutation({
          action: "invoice.cancel",
          resourceId: id,
          idempotencyKey,
          confirmationId,
          request: { id },
          mutate: () =>
            updateInvoice(db, {
              id,
              teamId,
              status: "canceled",
              userId,
            }),
        });

        if (!result) {
          return {
            content: [{ type: "text", text: "Failed to cancel invoice" }],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      },
    );
  }
};
