import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  getInsightById,
  getInsightsForUser,
  getLatestInsight,
} from "@tamias/app-data/queries";
import { HTTPException } from "hono/http-exception";
import {
  insightByIdSchema,
  insightResponseSchema,
  insightsListResponseSchema,
  latestInsightSchema,
  listInsightsSchema,
} from "../../schemas/insights";
import { validateResponse } from "../../utils/validate-response";
import { withRequiredScope } from "../middleware";
import type { Context } from "../types";

const errorResponseSchema = z.object({
  error: z.string(),
});

const app = new OpenAPIHono<Context>();

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    summary: "List insights",
    operationId: "listInsights",
    "x-speakeasy-name-override": "list",
    description:
      "Retrieve a paginated list of AI-generated business insights for the authenticated team.",
    tags: ["Insights"],
    request: {
      query: listInsightsSchema,
    },
    responses: {
      200: {
        description: "List of insights",
        content: {
          "application/json": {
            schema: insightsListResponseSchema,
          },
        },
      },
    },
    middleware: [withRequiredScope("insights.read")],
  }),
  async (c) => {
    const db = c.get("db");
    const teamId = c.get("teamId");
    const session = c.get("session");
    const { limit, cursor, periodType, includeDismissed } = c.req.valid("query");

    if (!session.user.id) {
      throw new HTTPException(500, {
        message: "Missing user id",
      });
    }

    const result = await getInsightsForUser(db, {
      teamId,
      userId: session.user.id,
      periodType: periodType ?? undefined,
      pageSize: limit ?? 10,
      cursor: cursor ?? null,
      includeDismissed: includeDismissed ?? false,
      status: "completed",
    });

    return c.json(validateResponse(result, insightsListResponseSchema));
  },
);

app.openapi(
  createRoute({
    method: "get",
    path: "/latest",
    summary: "Get latest insight",
    operationId: "getLatestInsight",
    "x-speakeasy-name-override": "latest",
    description: "Get the most recent completed insight, optionally filtered by period type.",
    tags: ["Insights"],
    request: {
      query: latestInsightSchema,
    },
    responses: {
      200: {
        description: "The latest insight",
        content: {
          "application/json": {
            schema: insightResponseSchema,
          },
        },
      },
      404: {
        description: "No insights available",
        content: {
          "application/json": {
            schema: errorResponseSchema,
          },
        },
      },
    },
    middleware: [withRequiredScope("insights.read")],
  }),
  async (c) => {
    const db = c.get("db");
    const teamId = c.get("teamId");
    const { periodType } = c.req.valid("query");

    const result = await getLatestInsight(db, {
      teamId,
      periodType: periodType ?? undefined,
    });

    if (!result) {
      return c.json({ error: "No insights available" }, 404);
    }

    return c.json(validateResponse(result, insightResponseSchema), 200);
  },
);

app.openapi(
  createRoute({
    method: "get",
    path: "/{id}",
    summary: "Get insight by ID",
    operationId: "getInsightById",
    "x-speakeasy-name-override": "get",
    description: "Retrieve a specific insight by its unique identifier.",
    tags: ["Insights"],
    request: {
      params: insightByIdSchema,
    },
    responses: {
      200: {
        description: "The requested insight",
        content: {
          "application/json": {
            schema: insightResponseSchema,
          },
        },
      },
      404: {
        description: "Insight not found",
        content: {
          "application/json": {
            schema: errorResponseSchema,
          },
        },
      },
    },
    middleware: [withRequiredScope("insights.read")],
  }),
  async (c) => {
    const db = c.get("db");
    const teamId = c.get("teamId");
    const { id } = c.req.valid("param");

    const result = await getInsightById(db, { id, teamId });

    if (!result) {
      return c.json({ error: "Insight not found" }, 404);
    }

    return c.json(validateResponse(result, insightResponseSchema), 200);
  },
);

export const insightsRouter = app;
