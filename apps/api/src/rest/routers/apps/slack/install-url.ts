import { protectedMiddleware } from "../../../middleware";
import type { Context } from "../../../types";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getInstallUrl } from "@tamias/app-store/slack/server";
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
    summary: "Get Slack install URL",
    operationId: "getSlackInstallUrl",
    description:
      "Generates OAuth install URL for Slack integration. Requires authentication.",
    tags: ["Integrations"],
    responses: {
      200: {
        description: "Slack install URL",
        content: {
          "application/json": {
            schema: installUrlResponseSchema,
          },
        },
      },
      401: {
        description: "Unauthorized",
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

    const url = await getInstallUrl({
      teamId: session.teamId,
      convexUserId: session.user.convexId,
    });

    return c.json({ url });
  },
);

export { app as installUrlRouter };
