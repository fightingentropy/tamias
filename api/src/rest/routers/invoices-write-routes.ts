import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import {
  allocateNextInvoiceNumber,
  deleteInvoice,
  draftInvoice,
  getCustomerById,
  getInvoiceById,
  getInvoiceNumberConflictMessage,
  getInvoiceTemplate,
  isInvoiceNumberConflictError,
  updateInvoice,
} from "@tamias/app-data/queries";
import type { Database } from "@tamias/app-data/client";
import { transformCustomerToContent } from "@tamias/invoice/utils";
import { addDays } from "date-fns";
import { HTTPException } from "hono/http-exception";
import { v4 as uuidv4 } from "uuid";
import { runIdempotentInvoiceMutation } from "../../invoice/mutation-safety";
import { getRestInvoiceTotals } from "../../invoice/rest-totals";
import {
  assertScheduledAtInFuture,
  createScheduledInvoiceJob,
  enqueueInvoiceGeneration,
  enqueueInvoiceScheduledNotification,
  removeInvoiceJob,
} from "../../invoice/transport";
import {
  deleteInvoiceResponseSchema,
  deleteInvoiceSchema,
  draftInvoiceRequestSchema,
  draftInvoiceResponseSchema,
  getInvoiceByIdSchema,
  idempotencyKeySchema,
  updateInvoiceRequestSchema,
  updateInvoiceResponseSchema,
} from "../../schemas/invoice";
import { validateResponse } from "../../utils/validate-response";
import { withRequiredScope } from "../middleware/scope";
import type { Context } from "../types";
import { requireRestUserId, restInvoiceLogger, serializeInvoiceForRest } from "./invoices-shared";

function requireIdempotencyKey(value: string | undefined) {
  const key = value?.trim();
  if (!key || key.length < 8 || key.length > 200 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new HTTPException(400, { message: "A valid Idempotency-Key header is required" });
  }
  return key;
}

async function saveRestInvoice(args: {
  db: Database;
  teamId: string;
  userId: string;
  input: z.infer<typeof draftInvoiceRequestSchema>;
  idempotencyKey: string;
  action: string;
  invoiceId?: string;
}) {
  const { db, teamId, userId, input, idempotencyKey } = args;
  const invoiceId = args.invoiceId ?? uuidv4();
  const createdInvoice = await runIdempotentInvoiceMutation({
    db,
    teamId,
    userId,
    action: args.action,
    resourceId: invoiceId,
    idempotencyKey,
    request: args.invoiceId ? { ...input, id: args.invoiceId } : input,
    mutate: async ({ markMutationApplied }) => {
      const existing = args.invoiceId
        ? await getInvoiceById(db, { id: args.invoiceId, teamId })
        : null;
      if (args.invoiceId && !existing)
        throw new HTTPException(404, { message: "Invoice not found" });
      if (existing && existing.status !== "draft")
        throw new HTTPException(409, {
          message: "Only draft invoices can be edited or issued through this endpoint",
        });
      const finalInvoiceNumber =
        input.invoiceNumber ||
        existing?.invoiceNumber ||
        (await allocateNextInvoiceNumber(db, teamId));
      const template = await getInvoiceTemplate(db, teamId);
      const paymentTermsDays = template?.paymentTermsDays ?? 30;
      const issueDate = input.issueDate || new Date().toISOString();
      const dueDate = input.dueDate || addDays(new Date(issueDate), paymentTermsDays).toISOString();

      const customer = await getCustomerById(db, {
        id: input.customerId,
        teamId,
      });

      if (!customer) {
        throw new HTTPException(404, { message: "Customer not found" });
      }

      if (
        input.deliveryType === "create_and_send" &&
        (input.expectedCustomerEmail !== undefined || input.expectedBillingEmails !== undefined)
      ) {
        const normalize = (value: string) => value.trim().toLowerCase();
        const emails = (values: string[]) =>
          [...new Set(values.map(normalize).filter(Boolean))].sort();
        const billing = emails((customer.billingEmail ?? "").split(","));
        if (
          !input.expectedCustomerEmail ||
          input.expectedBillingEmails === undefined ||
          normalize(customer.email ?? "") !== normalize(input.expectedCustomerEmail) ||
          JSON.stringify(billing) !== JSON.stringify(emails(input.expectedBillingEmails))
        ) {
          throw new HTTPException(409, {
            res: Response.json(
              {
                code: "invoice_review_changed",
                description:
                  "Invoice recipients changed before this request was applied. Review the customer and recipients before submitting again.",
              },
              { status: 409 },
            ),
          });
        }
      }

      const customerDetails = transformCustomerToContent(customer);
      const totals = input.lineItems
        ? getRestInvoiceTotals({
            ...input,
            lineItems: input.lineItems.map((item) => ({
              ...item,
              taxRate: item.taxRate ?? undefined,
            })),
          })
        : undefined;
      if (totals && Object.values(totals).some((value) => !Number.isFinite(value))) {
        throw new HTTPException(400, { message: "Invoice totals must be finite" });
      }
      for (const field of ["amount", "vat", "tax"] as const) {
        if (totals && input[field] != null && Math.abs(input[field] - totals[field]) > 0.000001) {
          throw new HTTPException(400, {
            message: `Invoice ${field} does not match the line items, taxes and discount; review the totals`,
          });
        }
      }

      const result = await (async () => {
        try {
          markMutationApplied({ invoiceId });
          return await draftInvoice(db, {
            id: invoiceId,
            teamId,
            userId,
            invoiceNumber: finalInvoiceNumber,
            issueDate,
            dueDate,
            template: input.template,
            paymentDetails: input.paymentDetails,
            fromDetails: input.fromDetails,
            customerDetails: customerDetails ? JSON.stringify(customerDetails) : null,
            noteDetails: input.noteDetails,
            customerId: input.customerId,
            customerName: customer.name,
            logoUrl: input.logoUrl,
            vat: totals?.vat ?? input.vat,
            tax: totals?.tax ?? input.tax,
            discount: input.discount,
            topBlock: input.topBlock,
            bottomBlock: input.bottomBlock,
            amount: totals?.amount ?? input.amount,
            subtotal: totals?.subtotal,
            lineItems: input.lineItems?.map((item) => ({
              ...item,
              name: JSON.stringify(item.name),
            })),
          });
        } catch (error) {
          if (isInvoiceNumberConflictError(error)) {
            throw new HTTPException(409, {
              message: getInvoiceNumberConflictMessage(finalInvoiceNumber),
            });
          }

          throw error;
        }
      })();

      if (!result) {
        throw new HTTPException(500, { message: "Failed to create invoice" });
      }
      markMutationApplied({ invoiceId: result.id });

      let finalResult = result;

      if (input.deliveryType === "create" || input.deliveryType === "create_and_send") {
        const updatedInvoice = await updateInvoice(db, {
          id: result.id,
          status: "unpaid",
          teamId,
          userId,
        });

        if (!updatedInvoice)
          throw new HTTPException(500, { message: "Invoice could not be finalized" });
        finalResult = updatedInvoice;

        await enqueueInvoiceGeneration({
          invoiceId: result.id,
          deliveryType: input.deliveryType,
          expectedCustomerEmail: input.expectedCustomerEmail,
          expectedBillingEmails: input.expectedBillingEmails,
        });
      } else if (input.deliveryType === "scheduled") {
        if (!input.scheduledAt) {
          throw new HTTPException(400, {
            message: "scheduledAt is required for scheduled delivery",
          });
        }

        const { delayMs } = assertScheduledAtInFuture(input.scheduledAt, () => {
          throw new HTTPException(400, {
            message: "scheduledAt must be in the future",
          });
        });
        let scheduledJobId: string;
        try {
          scheduledJobId = await createScheduledInvoiceJob(result.id, delayMs);
        } catch {
          throw new HTTPException(500, {
            message: "Failed to create scheduled job - no job ID returned",
          });
        }

        const updatedInvoice = await updateInvoice(db, {
          id: result.id,
          status: "scheduled",
          scheduledAt: input.scheduledAt,
          scheduledJobId,
          teamId,
          userId,
        });

        if (!updatedInvoice) {
          await removeInvoiceJob(scheduledJobId, {
            logFailureMessage: "Failed to clean up orphaned scheduled job",
            logger: restInvoiceLogger,
          });

          throw new HTTPException(404, {
            message: "Invoice not found",
          });
        }

        finalResult = updatedInvoice;

        enqueueInvoiceScheduledNotification({
          teamId,
          invoiceId: result.id,
          invoiceNumber: finalResult.invoiceNumber!,
          scheduledAt: input.scheduledAt,
          customerName: finalResult.customerName ?? undefined,
        });
      }

      return finalResult;
    },
  });

  return createdInvoice;
}

export function registerInvoiceWriteRoutes(app: OpenAPIHono<Context>) {
  app.openapi(
    createRoute({
      method: "post",
      path: "/",
      summary: "Create an invoice",
      operationId: "createInvoice",
      "x-speakeasy-name-override": "create",
      description:
        "Create an invoice for the authenticated team. The behavior depends on deliveryType: 'draft' saves a draft without issuing or sending; 'create' generates and finalizes the invoice immediately, 'create_and_send' also sends it to the customer, 'scheduled' schedules the invoice for automatic processing at the specified date.",
      tags: ["Invoices"],
      request: {
        headers: z.object({ "Idempotency-Key": idempotencyKeySchema }),
        body: {
          content: {
            "application/json": {
              schema: draftInvoiceRequestSchema,
            },
          },
        },
      },
      responses: {
        201: {
          description:
            "Invoice created successfully. Status depends on deliveryType: 'draft' for drafts, 'scheduled' for scheduled invoices, 'unpaid' for create/create_and_send.",
          content: {
            "application/json": {
              schema: draftInvoiceResponseSchema,
            },
          },
        },
        400: {
          description: "Bad request. Invalid input data or validation errors.",
          content: {
            "application/json": {
              schema: z.object({
                message: z.string().openapi({
                  description: "Error message describing the validation failure",
                  examples: [
                    "scheduledAt is required for scheduled delivery",
                    "scheduledAt must be in the future",
                    "Invoice number 'INV-001' is already used. Please provide a different invoice number or omit it to auto-generate one.",
                  ],
                }),
              }),
            },
          },
        },
        404: {
          description: "Customer not found.",
          content: {
            "application/json": {
              schema: z.object({
                message: z.string().openapi({
                  description: "Error message",
                  example: "Customer not found",
                }),
              }),
            },
          },
        },
        409: {
          description: "Conflict. Invoice number already exists.",
          content: {
            "application/json": {
              schema: z.object({
                message: z.string().openapi({
                  description: "Error message about the conflict",
                  example:
                    "Invoice number 'INV-2024-001' is already used. Please provide a different invoice number or omit it to auto-generate one.",
                }),
              }),
            },
          },
        },
        500: {
          description: "Internal server error.",
          content: {
            "application/json": {
              schema: z.object({
                message: z.string().openapi({
                  description: "Error message",
                  example: "Failed to create invoice",
                }),
              }),
            },
          },
        },
      },
      middleware: [withRequiredScope("invoices.write")],
    }),
    async (c) => {
      const db = c.get("db");
      const teamId = c.get("teamId");
      const session = c.get("session");
      const input = c.req.valid("json");
      const userId = requireRestUserId(session);
      const idempotencyKey = requireIdempotencyKey(c.req.header("idempotency-key"));

      const createdInvoice = await saveRestInvoice({
        db,
        teamId,
        userId,
        input,
        idempotencyKey,
        action: "rest.create",
      });

      return c.json(
        validateResponse(serializeInvoiceForRest(createdInvoice), draftInvoiceResponseSchema),
        201,
      );
    },
  );

  for (const operation of ["draft", "issue"] as const) {
    const schema = draftInvoiceRequestSchema.extend({
      deliveryType:
        operation === "draft" ? z.literal("draft") : z.enum(["create", "create_and_send"]),
      scheduledAt: z.never().openapi({ type: "string", not: {} }).optional(),
    });
    app.openapi(
      createRoute({
        method: operation === "draft" ? "put" : "post",
        path: `/{id}/${operation}`,
        tags: ["Invoices"],
        operationId: operation === "draft" ? "saveInvoiceDraft" : "issueInvoiceDraft",
        summary:
          operation === "draft"
            ? "Save an existing draft invoice"
            : "Issue an existing draft invoice",
        request: {
          headers: z.object({ "Idempotency-Key": idempotencyKeySchema }),
          params: getInvoiceByIdSchema.pick({ id: true }),
          body: { required: true, content: { "application/json": { schema } } },
        },
        responses: {
          200: {
            description: "Existing invoice updated",
            content: { "application/json": { schema: draftInvoiceResponseSchema } },
          },
        },
        middleware: [withRequiredScope("invoices.write")],
      }),
      async (c) => {
        const result = await saveRestInvoice({
          db: c.get("db"),
          teamId: c.get("teamId"),
          userId: requireRestUserId(c.get("session")),
          input: c.req.valid("json"),
          invoiceId: c.req.valid("param").id,
          idempotencyKey: requireIdempotencyKey(c.req.header("idempotency-key")),
          action: `rest.${operation}`,
        });
        return c.json(
          validateResponse(serializeInvoiceForRest(result), draftInvoiceResponseSchema),
        );
      },
    );
  }

  app.openapi(
    createRoute({
      method: "put",
      path: "/{id}",
      summary: "Update an invoice",
      operationId: "updateInvoice",
      "x-speakeasy-name-override": "update",
      description: "Update an invoice by its unique identifier for the authenticated team.",
      tags: ["Invoices"],
      request: {
        headers: z.object({ "Idempotency-Key": idempotencyKeySchema }),
        params: getInvoiceByIdSchema.pick({ id: true }),
        body: {
          content: {
            "application/json": {
              schema: updateInvoiceRequestSchema,
            },
          },
        },
      },
      responses: {
        200: {
          description: "Invoice updated successfully.",
          content: {
            "application/json": {
              schema: updateInvoiceResponseSchema,
            },
          },
        },
      },
      middleware: [withRequiredScope("invoices.write")],
    }),
    async (c) => {
      const db = c.get("db");
      const teamId = c.get("teamId");
      const session = c.get("session");
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const userId = requireRestUserId(session);

      const result = await runIdempotentInvoiceMutation({
        db,
        teamId,
        userId,
        action: "rest.update",
        resourceId: id,
        idempotencyKey: requireIdempotencyKey(c.req.header("idempotency-key")),
        request: { id, ...input },
        mutate: () => updateInvoice(db, { id, teamId, userId, ...input }),
      });

      if (!result) {
        throw new HTTPException(404, { message: "Invoice not found" });
      }

      return c.json(validateResponse(serializeInvoiceForRest(result), updateInvoiceResponseSchema));
    },
  );

  app.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      summary: "Delete a invoice",
      operationId: "deleteInvoice",
      "x-speakeasy-name-override": "delete",
      description:
        "Delete an invoice by its unique identifier for the authenticated team. Only invoices with status 'draft' or 'canceled' can be deleted directly. If the invoice is not in one of these statuses, update its status to 'canceled' before attempting deletion.",
      tags: ["Invoices"],
      request: {
        headers: z.object({ "Idempotency-Key": idempotencyKeySchema }),
        params: deleteInvoiceSchema.pick({ id: true }),
      },
      responses: {
        200: {
          description: "Delete a invoice by its unique identifier for the authenticated team.",
          content: {
            "application/json": {
              schema: deleteInvoiceResponseSchema,
            },
          },
        },
      },
      middleware: [withRequiredScope("invoices.write")],
    }),
    async (c) => {
      const db = c.get("db");
      const teamId = c.get("teamId");
      const session = c.get("session");
      const { id } = c.req.valid("param");

      const result = await runIdempotentInvoiceMutation({
        db,
        teamId,
        userId: requireRestUserId(session),
        action: "rest.delete",
        resourceId: id,
        idempotencyKey: requireIdempotencyKey(c.req.header("idempotency-key")),
        request: { id },
        mutate: () => deleteInvoice(db, { id, teamId }),
      });

      return c.json(validateResponse(result, deleteInvoiceResponseSchema));
    },
  );
}
