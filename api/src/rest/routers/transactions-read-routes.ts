import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import { getTransactionAttachment } from "@tamias/app-data/queries";
import { getTransactionByIdForTeam, getTransactionsPage } from "@tamias/app-services/transactions";
import {
  getTransactionAttachmentPreSignedUrlSchema,
  getTransactionByIdSchema,
  getTransactionsSchema,
  transactionAttachmentPreSignedUrlResponseSchema,
  transactionResponseSchema,
  transactionsResponseSchema,
} from "../../schemas/transactions";
import { getVaultSignedUrl } from "../../services/storage";
import { validateResponse } from "../../utils/validate-response";
import { withRequiredScope } from "../middleware";
import type { Context } from "../types";

export function registerTransactionReadRoutes(app: OpenAPIHono<Context>) {
  app.openapi(
    createRoute({
      method: "get",
      path: "/",
      summary: "List all transactions",
      operationId: "listTransactions",
      "x-speakeasy-name-override": "list",
      description: "Retrieve a list of transactions for the authenticated team.",
      tags: ["Transactions"],
      request: {
        query: getTransactionsSchema,
      },
      responses: {
        200: {
          description: "Retrieve a list of transactions for the authenticated team.",
          content: {
            "application/json": {
              schema: transactionsResponseSchema,
            },
          },
        },
      },
      middleware: [withRequiredScope("transactions.read")],
    }),
    async (c) => {
      const db = c.get("db");
      const teamId = c.get("teamId");
      const query = c.req.valid("query");

      const data = await getTransactionsPage({
        db,
        teamId,
        input: query,
      });

      return c.json(validateResponse(data, transactionsResponseSchema));
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/{id}",
      summary: "Retrieve a transaction",
      operationId: "getTransactionById",
      "x-speakeasy-name-override": "get",
      description: "Retrieve a transaction by its ID for the authenticated team.",
      tags: ["Transactions"],
      request: {
        params: getTransactionByIdSchema.pick({ id: true }),
      },
      responses: {
        200: {
          description: "Transaction details",
          content: {
            "application/json": {
              schema: transactionResponseSchema,
            },
          },
        },
      },
      middleware: [withRequiredScope("transactions.read")],
    }),
    async (c) => {
      const db = c.get("db");
      const teamId = c.get("teamId");
      const { id } = c.req.valid("param");

      const result = await getTransactionByIdForTeam({
        db,
        teamId,
        input: { id },
      });

      return c.json(validateResponse(result, transactionResponseSchema));
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{transactionId}/attachments/{attachmentId}/presigned-url",
      summary: "Generate pre-signed URL for transaction attachment",
      operationId: "getTransactionAttachmentPreSignedUrl",
      "x-speakeasy-name-override": "getAttachmentPreSignedUrl",
      description:
        "Generate a pre-signed URL for accessing a transaction attachment. The URL is valid for 60 seconds and allows secure temporary access to the attachment file.",
      tags: ["Transactions"],
      request: {
        params: getTransactionAttachmentPreSignedUrlSchema.pick({
          transactionId: true,
          attachmentId: true,
        }),
        query: getTransactionAttachmentPreSignedUrlSchema.pick({
          download: true,
        }),
      },
      responses: {
        200: {
          description: "Pre-signed URL generated successfully",
          content: {
            "application/json": {
              schema: transactionAttachmentPreSignedUrlResponseSchema,
            },
          },
        },
        400: {
          description: "Bad request - Attachment file path not available",
          content: {
            "application/json": {
              schema: z.object({
                error: z.string(),
              }),
            },
          },
        },
        404: {
          description: "Transaction or attachment not found",
          content: {
            "application/json": {
              schema: z.object({
                error: z.string(),
              }),
            },
          },
        },
        500: {
          description: "Internal server error - Failed to generate pre-signed URL",
          content: {
            "application/json": {
              schema: z.object({
                error: z.string(),
              }),
            },
          },
        },
      },
      middleware: [withRequiredScope("transactions.read")],
    }),
    async (c) => {
      const db = c.get("db");
      const teamId = c.get("teamId");
      const { transactionId, attachmentId } = c.req.valid("param");
      const { download = true } = c.req.valid("query");

      const attachment = await getTransactionAttachment(db, {
        transactionId,
        attachmentId,
        teamId,
      });

      if (!attachment) {
        return c.json({ error: "Transaction attachment not found" }, 404);
      }

      if (!attachment.path || attachment.path.length === 0) {
        return c.json({ error: "Attachment file path not available" }, 400);
      }

      const filePath = attachment.path.join("/");
      const expireIn = 60;

      const { data, error } = await getVaultSignedUrl({
        path: filePath,
        expireIn,
        options: {
          download,
        },
      });

      if (error || !data?.signedUrl) {
        return c.json({ error: "Failed to generate pre-signed URL" }, 500);
      }

      const expiresAt = new Date(Date.now() + expireIn * 1000).toISOString();

      const result = {
        url: data.signedUrl,
        expiresAt,
        fileName: attachment.name || attachment.path.at(-1) || null,
      };

      return c.json(validateResponse(result, transactionAttachmentPreSignedUrlResponseSchema), 200);
    },
  );
}
