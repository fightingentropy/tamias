import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TrueLayerApi } from "@tamias/banking";
import { decryptOAuthState, encryptOAuthState } from "@tamias/encryption";
import { logger } from "@tamias/logger";
import { getAppUrl } from "@tamias/utils/envs";
import type { TrueLayerOAuthStatePayload } from "../../../../trpc/routers/banking";
import { publicMiddleware } from "../../../middleware";
import type { Context } from "../../../types";
import { buildErrorRedirect, mapOAuthError } from "../../../utils/oauth";

const app = new OpenAPIHono<Context>();

const paramsSchema = z.object({
  code: z
    .string()
    .optional()
    .openapi({
      param: { in: "query", name: "code", required: false },
      description: "OAuth authorization code from TrueLayer",
    }),
  state: z
    .string()
    .optional()
    .openapi({
      param: { in: "query", name: "state", required: false },
      description: "Encrypted OAuth state for CSRF protection",
    }),
  error: z
    .string()
    .optional()
    .openapi({
      param: { in: "query", name: "error", required: false },
      description: "OAuth error code if authorization failed",
    }),
  error_description: z
    .string()
    .optional()
    .openapi({
      param: { in: "query", name: "error_description", required: false },
      description: "Human-readable description of the OAuth error",
    }),
});

function isValidState(parsed: unknown): parsed is TrueLayerOAuthStatePayload {
  if (!parsed || typeof parsed !== "object") return false;
  const record = parsed as Record<string, unknown>;
  return (
    typeof record.teamId === "string" &&
    typeof record.userId === "string" &&
    typeof record.institutionId === "string" &&
    typeof record.reconnect === "boolean" &&
    record.source === "connect"
  );
}

app.use("*", ...publicMiddleware);

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    summary: "TrueLayer OAuth callback",
    operationId: "trueLayerOAuthCallback",
    description:
      "Handles OAuth callback from TrueLayer after user authorization. Exchanges authorization code for access + refresh tokens and redirects back to the Connect modal with an encrypted token blob.",
    tags: ["Banking"],
    request: {
      query: paramsSchema,
    },
    responses: {
      302: {
        description: "Redirect to dashboard",
        headers: {
          Location: {
            schema: { type: "string" },
            description: "Redirect URL to dashboard",
          },
        },
      },
    },
  }),
  async (c) => {
    const query = c.req.valid("query");
    const { code, state, error, error_description } = query;
    const dashboardUrl = getAppUrl();

    const parsedState = state ? decryptOAuthState(state, isValidState) : null;

    if (error || !code) {
      const errorCode = mapOAuthError(error);
      logger.info("TrueLayer OAuth cancelled or errored", {
        error,
        description: error_description,
        errorCode,
      });
      return c.redirect(buildErrorRedirect(dashboardUrl, errorCode, "truelayer"), 302);
    }

    if (!parsedState) {
      logger.warn("TrueLayer OAuth callback received invalid or missing state");
      return c.redirect(buildErrorRedirect(dashboardUrl, "invalid_state", "truelayer"), 302);
    }

    try {
      const api = new TrueLayerApi();
      const tokens = await api.exchangeCode(code);

      const encryptedTokenBlob = encryptOAuthState(tokens);

      const params = new URLSearchParams({
        step: "account",
        provider: "truelayer",
        token: encryptedTokenBlob,
        institution_id: parsedState.institutionId,
      });

      if (parsedState.reconnect && parsedState.connectionId) {
        params.set("ref", parsedState.connectionId);
      }

      return c.redirect(`${dashboardUrl}/transactions?${params.toString()}`, 302);
    } catch (err) {
      logger.error("TrueLayer OAuth token exchange failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return c.redirect(
        buildErrorRedirect(dashboardUrl, "token_exchange_failed", "truelayer"),
        302,
      );
    }
  },
);

export { app as oauthCallbackRouter };
