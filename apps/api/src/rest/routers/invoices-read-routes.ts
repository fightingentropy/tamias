import type { Context } from "../types";
import {
  getInvoiceByIdSchema,
  getInvoicesSchema,
  getPaymentStatusResponseSchema,
  invoiceResponseSchema,
  invoiceSummaryResponseSchema,
  invoiceSummarySchema,
  invoicesResponseSchema,
} from "../../schemas/invoice";
import { validateResponse } from "../../utils/validate-response";
import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import {
  getInvoicePaymentStatusForTeam,
  getInvoicesPage,
  getInvoiceSummaryForTeam,
} from "@tamias/app-services/invoices";
import { getInvoiceById } from "@tamias/app-data/queries";
import { HTTPException } from "hono/http-exception";
import { withRequiredScope } from "../middleware";
import {
  serializeInvoiceForRest,
  serializeInvoicePageForRest,
} from "./invoices-shared";

export function registerInvoiceReadRoutes(app: OpenAPIHono<Context>) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/",
      summary: "List all invoices",
      operationId: "listInvoices",
      "x-speakeasy-name-override": "list",
      description: "Retrieve a list of invoices for the authenticated team.",
      tags: ["Invoices"],
      request: {
        query: getInvoicesSchema,
      },
      responses: {
        200: {
          description: "A list of invoices for the authenticated team.",
          content: {
            "application/json": {
              schema: invoicesResponseSchema,
            },
          },
        },
      },
      middleware: [withRequiredScope("invoices.read")],
    }),
    async (c) => {
      const db = c.get("db");
      const teamId = c.get("teamId");
      const { pageSize, cursor, sort, ...filter } = c.req.valid("query");

      const result = await getInvoicesPage({
        db,
        teamId,
        input: {
          pageSize,
          cursor,
          sort,
          ...filter,
        },
      });

      return c.json(
        validateResponse(
          serializeInvoicePageForRest(result),
          invoicesResponseSchema,
        ),
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/payment-status",
      summary: "Payment status",
      description: "Get payment status for the authenticated team.",
      tags: ["Invoices"],
      responses: {
        200: {
          description: "Payment status for the authenticated team.",
          content: {
            "application/json": {
              schema: getPaymentStatusResponseSchema,
            },
          },
        },
      },
      middleware: [withRequiredScope("invoices.read")],
    }),
    async (c) => {
      const db = c.get("db");
      const teamId = c.get("teamId");

      const result = await getInvoicePaymentStatusForTeam({
        db,
        teamId,
      });

      return c.json(validateResponse(result, getPaymentStatusResponseSchema));
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/summary",
      summary: "Invoice summary",
      operationId: "getInvoiceSummary",
      "x-speakeasy-name-override": "summary",
      description: "Get summary of invoices for the authenticated team.",
      tags: ["Invoices"],
      request: {
        query: invoiceSummarySchema,
      },
      responses: {
        200: {
          description: "Summary of invoices for the authenticated team.",
          content: {
            "application/json": {
              schema: invoiceSummaryResponseSchema,
            },
          },
        },
      },
      middleware: [withRequiredScope("invoices.read")],
    }),
    async (c) => {
      const db = c.get("db");
      const teamId = c.get("teamId");
      const { statuses } = c.req.valid("query");

      const result = await getInvoiceSummaryForTeam({
        db,
        teamId,
        statuses,
      });

      return c.json(validateResponse(result, invoiceSummaryResponseSchema));
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/{id}",
      summary: "Retrieve a invoice",
      operationId: "getInvoiceById",
      "x-speakeasy-name-override": "get",
      description:
        "Retrieve a invoice by its unique identifier for the authenticated team.",
      tags: ["Invoices"],
      request: {
        params: getInvoiceByIdSchema.pick({ id: true }),
      },
      responses: {
        200: {
          description:
            "Retrieve a invoice by its unique identifier for the authenticated team.",
          content: {
            "application/json": {
              schema: invoiceResponseSchema,
            },
          },
        },
      },
      middleware: [withRequiredScope("invoices.read")],
    }),
    async (c) => {
      const db = c.get("db");
      const teamId = c.get("teamId");
      const { id } = c.req.valid("param");

      const result = await getInvoiceById(db, {
        id,
        teamId,
      });

      if (!result) {
        throw new HTTPException(404, { message: "Invoice not found" });
      }

      return c.json(
        validateResponse(
          serializeInvoiceForRest(result),
          invoiceResponseSchema,
        ),
      );
    },
  );
}
