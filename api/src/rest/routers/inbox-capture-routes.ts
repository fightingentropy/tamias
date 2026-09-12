import { createRoute, type OpenAPIHono, z } from "@hono/zod-openapi";
import {
  confirmSuggestedMatch,
  createInbox,
  matchTransaction,
  updateInbox,
} from "@tamias/app-data/queries";
import { upsertDocuments } from "@tamias/app-data/queries/documents/records";
import { getInboxItemForTeam } from "@tamias/app-services/inbox";
import { getTransactionByIdForTeam } from "@tamias/app-services/transactions";
import { enqueue } from "@tamias/job-client";
import { registerUploadedR2VaultFile } from "@tamias/storage";
import { HTTPException } from "hono/http-exception";
import { errors as joseErrors } from "jose";
import { idempotencyKeySchema } from "../../schemas/invoice";
import { runIdempotentMutation } from "../../services/mutation-safety";
import {
  createReceiptUploadUrl,
  maxReceiptUploadBytes,
  verifyReceiptUploadToken,
} from "../../services/r2-upload";
import { withRequiredScope } from "../middleware/scope";
import type { Context } from "../types";
import { requireRestUserId } from "./invoices-shared";

const headers = z.object({ "Idempotency-Key": idempotencyKeySchema });
const params = z.object({ id: z.string().min(1) });
const receiptResponse = z.object({
  id: z.string(),
  status: z.string(),
  filePath: z.array(z.string()),
});
const runResponse = z.object({ runId: z.string() });
const ticketRequest = z.object({
  fileName: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[^/\\]+$/)
    .refine((value) => [...value].every((character) => character.charCodeAt(0) >= 32))
    .refine((value) => value !== "." && value !== ".."),
  contentType: z.enum(["image/jpeg", "image/png", "image/heic", "image/heif", "application/pdf"]),
  size: z.number().int().min(1).max(maxReceiptUploadBytes),
});
const completionRequest = z.object({
  uploadToken: z.string().min(1).max(4000),
  displayName: z.string().min(1).max(500).optional(),
  amount: z.number().finite().nullable().optional(),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/)
    .transform((value) => value.toUpperCase())
    .optional(),
  date: z.string().date().nullable().optional(),
  note: z.string().max(10000).optional(),
});

function response<T extends z.ZodType>(schema: T, description: string) {
  return { description, content: { "application/json": { schema } } };
}

export function registerInboxCaptureRoutes(app: OpenAPIHono<Context>) {
  app.openapi(
    createRoute({
      method: "post",
      path: "/uploads",
      tags: ["Inbox"],
      operationId: "createInboxUpload",
      summary: "Create a team-bound receipt upload ticket",
      request: {
        body: { required: true, content: { "application/json": { schema: ticketRequest } } },
      },
      responses: {
        200: response(
          z.object({
            uploadUrl: z.string().url(),
            uploadToken: z.string(),
            storageId: z.string(),
            expiresAt: z.string(),
          }),
          "Upload ticket valid for 15 minutes",
        ),
      },
      middleware: [withRequiredScope("inbox.write")],
    }),
    async (c) =>
      c.json(
        await createReceiptUploadUrl(
          { ...c.req.valid("json"), teamId: c.get("teamId") },
          c.env.API_URL,
        ),
      ),
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/uploads/complete",
      tags: ["Inbox"],
      operationId: "completeInboxUpload",
      summary: "Register an uploaded receipt in the inbox",
      request: {
        headers,
        body: { required: true, content: { "application/json": { schema: completionRequest } } },
      },
      responses: {
        201: response(receiptResponse, "Receipt registered; call process to extract and match"),
      },
      middleware: [withRequiredScope("inbox.write")],
    }),
    async (c) => {
      const db = c.get("db");
      const teamId = c.get("teamId");
      const input = c.req.valid("json");
      const result = await runIdempotentMutation({
        db,
        teamId,
        userId: requireRestUserId(c.get("session")),
        scope: "inbox.rest.upload.complete",
        resourceType: "inbox",
        resourceId: "upload",
        idempotencyKey: c.req.header("idempotency-key")!,
        request: input,
        mutate: async ({ markMutationApplied }) => {
          // Replay precedes ticket verification so a lost response can be recovered after expiry.
          let claims: Awaited<ReturnType<typeof verifyReceiptUploadToken>>;
          try {
            claims = await verifyReceiptUploadToken(input.uploadToken, teamId);
          } catch (error) {
            if (error instanceof joseErrors.JWTExpired) {
              throw new HTTPException(410, {
                res: Response.json(
                  {
                    code: "upload_ticket_expired",
                    description:
                      "This upload ticket expired before the receipt was registered. Request a new upload ticket and upload the receipt again.",
                  },
                  { status: 410 },
                ),
              });
            }
            throw new HTTPException(400, { message: "Invalid or expired receipt upload ticket" });
          }
          const object = await c.env.VAULT_BUCKET.head(claims.storageId);
          if (
            !object ||
            object.size !== claims.size ||
            object.httpMetadata?.contentType !== claims.contentType
          ) {
            throw new HTTPException(400, {
              message: "Uploaded receipt is missing or does not match its ticket",
            });
          }
          const uploadId = claims.storageId.split("/").at(-1)!;
          const filePath = [teamId, "inbox", uploadId, claims.fileName];
          // Storage registration and inbox creation span services. An ambiguous failure must be reconciled, never repeated blindly.
          markMutationApplied({ storageId: claims.storageId, filePath });
          const registered = await registerUploadedR2VaultFile({
            pathTokens: filePath,
            storageId: claims.storageId,
            contentType: claims.contentType,
            size: claims.size,
          });
          if (registered.error || !registered.data)
            throw registered.error ?? new Error("Failed to register receipt");
          await upsertDocuments(db, {
            documents: [
              {
                teamId,
                name: filePath.join("/"),
                pathTokens: filePath,
                objectId: registered.data.storageId,
                metadata: { mimetype: claims.contentType, size: claims.size },
                processingStatus: "pending",
              },
            ],
          });
          const item = await createInbox(db, {
            teamId,
            displayName: input.displayName ?? claims.fileName,
            fileName: claims.fileName,
            filePath,
            contentType: claims.contentType,
            size: claims.size,
            referenceId: `native:${uploadId}`,
            status: "new",
            meta: {
              source: "native",
              capturedFields: {
                displayName: input.displayName,
                amount: input.amount,
                currency: input.currency,
                date: input.date,
                note: input.note,
              },
            },
          });
          markMutationApplied({ inboxId: item.id, filePath });
          await updateInbox(db, {
            id: item.id,
            teamId,
            displayName: input.displayName,
            amount: input.amount,
            currency: input.currency,
            date: input.date,
            description: input.note,
          });
          return { id: item.id, filePath, status: "new" };
        },
      });
      return c.json(result, 201);
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{id}/process",
      tags: ["Inbox"],
      operationId: "processInboxReceipt",
      summary: "Extract receipt data and suggest a transaction match",
      request: { headers, params },
      responses: { 202: response(runResponse, "Receipt processing queued") },
      middleware: [withRequiredScope("inbox.write")],
    }),
    async (c) => {
      const db = c.get("db");
      const teamId = c.get("teamId");
      const { id } = c.req.valid("param");
      const result = await runIdempotentMutation({
        db,
        teamId,
        userId: requireRestUserId(c.get("session")),
        scope: "inbox.rest.process",
        resourceType: "inbox",
        resourceId: id,
        idempotencyKey: c.req.header("idempotency-key")!,
        request: { id },
        mutate: async ({ markMutationApplied }) => {
          const item = await getInboxItemForTeam({ db, teamId, inboxId: id });
          if (!item) throw new HTTPException(404, { message: "Inbox item not found" });
          if (
            !item.filePath?.length ||
            item.filePath[0] !== teamId ||
            !item.contentType ||
            !item.size
          )
            throw new HTTPException(400, { message: "Receipt attachment is unavailable" });
          markMutationApplied({ inboxId: id });
          const job = await enqueue(
            "process-attachment",
            { teamId, filePath: item.filePath, mimetype: item.contentType, size: item.size },
            "inbox",
            { publicTeamId: teamId },
          );
          return { runId: job.runId };
        },
      });
      return c.json(result, 202);
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/{id}/matches",
      tags: ["Inbox"],
      operationId: "getInboxMatchSuggestions",
      summary: "Read the current suggested transaction",
      request: { params },
      responses: {
        200: response(
          z.object({
            data: z.array(
              z.object({
                id: z.string(),
                transactionId: z.string(),
                confidenceScore: z.number(),
                matchType: z.string(),
                status: z.string(),
                transaction: z
                  .object({
                    id: z.string(),
                    name: z.string(),
                    date: z.string(),
                    amount: z.number(),
                    currency: z.string(),
                  })
                  .nullable(),
              }),
            ),
          }),
          "Suggested match, if available",
        ),
      },
      middleware: [withRequiredScope("inbox.read"), withRequiredScope("transactions.read")],
    }),
    async (c) => {
      const item = await getInboxItemForTeam({
        db: c.get("db"),
        teamId: c.get("teamId"),
        inboxId: c.req.valid("param").id,
      });
      if (!item) throw new HTTPException(404, { message: "Inbox item not found" });
      const suggestion = item.suggestion;
      return c.json({
        data: suggestion
          ? [
              {
                id: suggestion.id,
                transactionId: suggestion.transactionId,
                confidenceScore: Number(suggestion.confidenceScore),
                matchType: suggestion.matchType,
                status: suggestion.status,
                transaction: suggestion.suggestedTransaction,
              },
            ]
          : [],
      });
    },
  );

  app.openapi(
    createRoute({
      method: "post",
      path: "/{id}/match",
      tags: ["Inbox"],
      operationId: "matchInboxReceipt",
      summary: "Confirm a receipt attachment for a transaction",
      request: {
        headers,
        params,
        body: {
          required: true,
          content: {
            "application/json": {
              schema: z.object({
                transactionId: z.string().min(1),
                suggestionId: z.string().min(1).optional(),
              }),
            },
          },
        },
      },
      responses: {
        200: response(
          z.object({ id: z.string(), transactionId: z.string(), status: z.literal("done") }),
          "Receipt attached to the selected transaction",
        ),
      },
      middleware: [withRequiredScope("inbox.write"), withRequiredScope("transactions.write")],
    }),
    async (c) => {
      const db = c.get("db");
      const teamId = c.get("teamId");
      const userId = requireRestUserId(c.get("session"));
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");
      const result = await runIdempotentMutation({
        db,
        teamId,
        userId,
        scope: "inbox.rest.match",
        resourceType: "inbox",
        resourceId: id,
        idempotencyKey: c.req.header("idempotency-key")!,
        request: { id, ...input },
        mutate: async ({ markMutationApplied }) => {
          const [item, transaction] = await Promise.all([
            getInboxItemForTeam({ db, teamId, inboxId: id }),
            getTransactionByIdForTeam({ db, teamId, input: { id: input.transactionId } }),
          ]);
          if (!item || !transaction)
            throw new HTTPException(404, { message: "Receipt or transaction not found" });
          if (item.transaction)
            throw new HTTPException(409, { message: "Receipt is already matched" });
          if (
            input.suggestionId &&
            (item.suggestion?.id !== input.suggestionId ||
              item.suggestion.transactionId !== input.transactionId)
          )
            throw new HTTPException(409, {
              message: "This suggestion is no longer available; refresh the receipt",
            });
          markMutationApplied({ inboxId: id, transactionId: input.transactionId });
          const matched = input.suggestionId
            ? await confirmSuggestedMatch(db, {
                teamId,
                inboxId: id,
                transactionId: input.transactionId,
                suggestionId: input.suggestionId,
                userId,
              })
            : await matchTransaction(db, { teamId, id, transactionId: input.transactionId });
          if (!matched) throw new Error("Receipt match could not be confirmed");
          return { id, transactionId: input.transactionId, status: "done" as const };
        },
      });
      return c.json(result);
    },
  );
}
