import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { encryptAccountingOAuthState, getAccountingProvider } from "@tamias/accounting";
import { HTTPException } from "hono/http-exception";
import { protectedMiddleware } from "../../../middleware";
import type { Context } from "../../../types";

const app = new OpenAPIHono<Context>();

const installUrlResponseSchema = z.object({
  url: z.string().url(),
});

app.use("*", ...protectedMiddleware);

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    summary: "Get Xero install URL",
    operationId: "getXeroInstallUrl",
    description: "Generates OAuth install URL for Xero integration. Requires authentication.",
    tags: ["Integrations"],
    responses: {
      200: {
        description: "Xero install URL",
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

    // Encrypt state to prevent tampering with teamId
    const state = encryptAccountingOAuthState({
      teamId: session.teamId,
      convexUserId: session.user.convexId,
      provider: "xero",
      source: "apps",
    });

    try {
      const provider = await getAccountingProvider("xero");
      const url = await provider.buildConsentUrl(state);
      return c.json({ url });
    } catch (error) {
      throw new HTTPException(500, {
        message: error instanceof Error ? error.message : "Xero OAuth configuration missing",
      });
    }
  },
);

export { app as installUrlRouter };
