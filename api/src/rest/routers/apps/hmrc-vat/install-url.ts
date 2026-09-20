import { setCookie } from "hono/cookie";
import { storeHmrcOAuthState } from "@tamias/app-data/queries";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { encryptComplianceOAuthState, HmrcVatProvider } from "@tamias/compliance";
import { HTTPException } from "hono/http-exception";
import { protectedMiddleware, withRequiredScope } from "../../../middleware";
import type { Context } from "../../../types";

const app = new OpenAPIHono<Context>();

const installUrlResponseSchema = z.object({
  url: z.string().url(),
});

app.use("*", ...protectedMiddleware, withRequiredScope("filings.write"));

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    summary: "Get HMRC VAT install URL",
    operationId: "getHmrcVatInstallUrl",
    description: "Generates OAuth install URL for HMRC VAT integration. Requires authentication.",
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

    if (!session.user.id) {
      throw new HTTPException(500, {
        message: "Missing user id",
      });
    }

    const state = encryptComplianceOAuthState({
      teamId: session.teamId,
      userId: session.user.id,
      provider: "hmrc-vat",
      source: "apps",
    });

    try {
      const provider = HmrcVatProvider.fromEnvironment();
      const url = provider.buildConsentUrl(state);
      const browserBinding = crypto.randomUUID();
      await storeHmrcOAuthState(c.get("db"), state, browserBinding);
      setCookie(c, "tamias_hmrc_oauth", browserBinding, {
        httpOnly: true,
        secure: new URL(c.req.url).protocol === "https:",
        sameSite: "Lax",
        path: "/apps/hmrc-vat/oauth-callback",
        maxAge: 600,
      });
      c.header("Cache-Control", "no-store");
      return c.json({ url });
    } catch (error) {
      throw new HTTPException(500, {
        message: error instanceof Error ? error.message : "HMRC VAT OAuth configuration missing",
      });
    }
  },
);

export { app as installUrlRouter };
