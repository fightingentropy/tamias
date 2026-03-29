import { publicMiddleware } from "../../../middleware";
import type { Context } from "../../../types";
import {
  buildErrorRedirect,
  buildSuccessRedirect,
  mapOAuthError,
} from "../../../utils/oauth";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import config from "@tamias/app-store/hmrc-vat";
import {
  decryptComplianceOAuthState,
  HmrcVatProvider,
} from "@tamias/compliance";
import { createApp } from "@tamias/app-data/queries";
import { logger } from "@tamias/logger";
import { getAppUrl } from "@tamias/utils/envs";
import { HTTPException } from "hono/http-exception";

const app = new OpenAPIHono<Context>();

const paramsSchema = z.object({
  code: z
    .string()
    .optional()
    .openapi({
      param: {
        in: "query",
        name: "code",
        required: false,
      },
      description: "OAuth authorization code from HMRC VAT",
    }),
  state: z.string().openapi({
    param: {
      in: "query",
      name: "state",
      required: true,
    },
    description: "OAuth state parameter for CSRF protection",
  }),
  error: z
    .string()
    .optional()
    .openapi({
      param: {
        in: "query",
        name: "error",
        required: false,
      },
      description: "OAuth error code if authorization failed",
    }),
});

app.use("*", ...publicMiddleware);

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    summary: "HMRC VAT OAuth callback",
    operationId: "hmrcVatOAuthCallback",
    description:
      "Handles OAuth callback from HMRC VAT after user authorization. Exchanges authorization code for access token and creates app integration.",
    tags: ["Integrations"],
    request: {
      query: paramsSchema,
    },
    responses: {
      302: {
        description: "Redirect to dashboard completion page",
        headers: {
          Location: {
            schema: {
              type: "string",
            },
            description: "Redirect URL to dashboard",
          },
        },
      },
      400: {
        description: "Invalid request parameters",
      },
    },
  }),
  async (c) => {
    const db = c.get("db");
    const query = c.req.valid("query");
    const { code, state, error } = query;
    const dashboardUrl =
      getAppUrl();
    const parsedState = decryptComplianceOAuthState(state);
    const source = parsedState?.source;

    if (error || !code) {
      const errorCode = mapOAuthError(error);
      logger.info("HMRC VAT OAuth error or cancelled", { error, errorCode });
      return c.redirect(
        buildErrorRedirect(dashboardUrl, errorCode, "hmrc-vat", source),
        302,
      );
    }

    if (!parsedState || parsedState.provider !== "hmrc-vat") {
      throw new HTTPException(400, {
        message: "Invalid or expired state. Please try connecting again.",
      });
    }

    try {
      const provider = HmrcVatProvider.fromEnvironment();
      const tokenSet = await provider.exchangeCodeForTokens(code);

      await createApp(db, {
        teamId: parsedState.teamId,
        createdByUserId: parsedState.convexUserId,
        appId: config.id,
        settings: config.settings,
        config: tokenSet,
      });

      logger.info("HMRC VAT integration created successfully", {
        teamId: parsedState.teamId,
        environment: tokenSet.environment,
      });

      return c.redirect(
        buildSuccessRedirect(dashboardUrl, "hmrc-vat", parsedState.source),
        302,
      );
    } catch (err) {
      logger.error("HMRC VAT OAuth callback error", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });

      return c.redirect(
        buildErrorRedirect(
          dashboardUrl,
          "token_exchange_failed",
          "hmrc-vat",
          parsedState.source,
        ),
        302,
      );
    }
  },
);

export { app as oauthCallbackRouter };
