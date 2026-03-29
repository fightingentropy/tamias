import { protectedMiddleware } from "../../../middleware";
import type { Context } from "../../../types";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  encryptComplianceOAuthState,
  HmrcVatProvider,
} from "@tamias/compliance";
import { HTTPException } from "hono/http-exception";

const app = new OpenAPIHono<Context>();

const installUrlResponseSchema = z.object({
  url: z.string().url(),
});

app.use("*", ...protectedMiddleware);

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    summary: "Get HMRC VAT install URL",
    operationId: "getHmrcVatInstallUrl",
    description:
      "Generates OAuth install URL for HMRC VAT integration. Requires authentication.",
    tags: ["Integrations"],
    responses: {
      200: {
        description: "HMRC VAT install URL",
        content: {
          "application/json": {
            schema: installUrlResponseSchema,
          },
        },
      },
      401: {
        description: "Unauthorized",
      },
      500: {
        description: "Server error",
      },
    },
  }),
  async (c) => {
    const session = c.get("session");

    if (!session?.user) {
      throw new HTTPException(401, {
        message: "Unauthorized",
      });
    }

    if (!session.teamId) {
      throw new HTTPException(401, {
        message: "Team not found",
      });
    }

    if (!session.user.convexId) {
      throw new HTTPException(500, {
        message: "Missing Convex user id",
      });
    }

    const state = encryptComplianceOAuthState({
      teamId: session.teamId,
      convexUserId: session.user.convexId,
      provider: "hmrc-vat",
      source: "apps",
    });

    try {
      const provider = HmrcVatProvider.fromEnvironment();
      const url = provider.buildConsentUrl(state);
      return c.json({ url });
    } catch (error) {
      throw new HTTPException(500, {
        message:
          error instanceof Error
            ? error.message
            : "HMRC VAT OAuth configuration missing",
      });
    }
  },
);

export { app as installUrlRouter };
