import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import {
  allocateNextInvoiceNumber,
  deleteInvoice,
  draftInvoice,
  getCustomerById,
  getInvoiceNumberConflictMessage,
  getInvoiceTemplate,
  isInvoiceNumberConflictError,
  updateInvoice,
} from "@tamias/app-data/queries";
import { transformCustomerToContent } from "@tamias/invoice/utils";
import { addDays } from "date-fns";
import { HTTPException } from "hono/http-exception";
import { v4 as uuidv4 } from "uuid";
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
  updateInvoiceRequestSchema,
  updateInvoiceResponseSchema,
} from "../../schemas/invoice";
import { validateResponse } from "../../utils/validate-response";
import { withRequiredScope } from "../middleware";
import type { Context } from "../types";
import {
  requireRestConvexUserId,
  restInvoiceLogger,
  serializeInvoiceForRest,
} from "./invoices-shared";

export function registerInvoiceWriteRoutes(app: OpenAPIHono<Context>) {
  app.openapi(
    createRoute({
      method: "post",
      path: "/",
      summary: "Create an invoice",
      operationId: "createInvoice",
      "x-speakeasy-name-override": "create",
      description:
        "Create an invoice for the authenticated team. The behavior depends on deliveryType: 'create' generates and finalizes the invoice immediately, 'create_and_send' also sends it to the customer, 'scheduled' schedules the invoice for automatic processing at the specified date.",
      tags: ["Invoices"],
      request: {
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
            "Invoice created successfully. Status depends on deliveryType: 'scheduled' for scheduled invoices, 'unpaid' for create/create_and_send.",
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
                  description:
                    "Error message describing the validation failure",
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
      const convexUserId = requireRestConvexUserId(session);

      const invoiceId = uuidv4();
      const finalInvoiceNumber =
        input.invoiceNumber || (await allocateNextInvoiceNumber(db, teamId));
      const template = await getInvoiceTemplate(teamId);
      const paymentTermsDays = template?.paymentTermsDays ?? 30;
      const issueDate = input.issueDate || new Date().toISOString();
      const dueDate =
        input.dueDate ||
        addDays(new Date(issueDate), paymentTermsDays).toISOString();

      const customer = await getCustomerById(db, {
        id: input.customerId,
        teamId,
      });

      if (!customer) {
        throw new HTTPException(404, { message: "Customer not found" });
      }

      const customerDetails = transformCustomerToContent(customer);

      const result = await (async () => {
        try {
          return await draftInvoice(db, {
            id: invoiceId,
            teamId,
            userId: convexUserId,
            invoiceNumber: finalInvoiceNumber,
            issueDate,
            dueDate,
            template: input.template,
            paymentDetails: input.paymentDetails,
            fromDetails: input.fromDetails,
            customerDetails: customerDetails
              ? JSON.stringify(customerDetails)
              : null,
            noteDetails: input.noteDetails,
            customerId: input.customerId,
            customerName: customer.name,
            logoUrl: input.logoUrl,
            vat: input.vat,
            tax: input.tax,
            discount: input.discount,
            topBlock: input.topBlock,
            bottomBlock: input.bottomBlock,
            amount: input.amount,
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

      let finalResult = result;

      if (
        input.deliveryType === "create" ||
        input.deliveryType === "create_and_send"
      ) {
        const updatedInvoice = await updateInvoice(db, {
          id: result.id,
          status: "unpaid",
          teamId,
          userId: convexUserId,
        });

        if (updatedInvoice) {
          finalResult = updatedInvoice;
        }

        await enqueueInvoiceGeneration({
          invoiceId: result.id,
          deliveryType: input.deliveryType,
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
          userId: convexUserId,
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

      return c.json(
        validateResponse(
          serializeInvoiceForRest(finalResult),
          draftInvoiceResponseSchema,
        ),
        201,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "put",
      path: "/{id}",
      summary: "Update an invoice",
      operationId: "updateInvoice",
      "x-speakeasy-name-override": "update",
      description:
        "Update an invoice by its unique identifier for the authenticated team.",
      tags: ["Invoices"],
      request: {
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

      const result = await updateInvoice(db, {
        id,
        teamId,
        userId: session.user.convexId ?? undefined,
        ...input,
      });

      if (!result) {
        throw new HTTPException(404, { message: "Invoice not found" });
      }

      return c.json(
        validateResponse(
          serializeInvoiceForRest(result),
          updateInvoiceResponseSchema,
        ),
      );
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
        params: deleteInvoiceSchema.pick({ id: true }),
      },
      responses: {
        200: {
          description:
            "Delete a invoice by its unique identifier for the authenticated team.",
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
      const { id } = c.req.valid("param");

      const result = await deleteInvoice(db, {
        id,
        teamId,
      });

      return c.json(validateResponse(result, deleteInvoiceResponseSchema));
    },
  );
}
