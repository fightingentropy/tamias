import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import type { Context } from "../../../types";

const app = new OpenAPIHono<Context>();

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    summary: "Get Xero install URL (removed)",
    operationId: "getXeroInstallUrl",
    description: "Xero integration has been removed.",
    tags: ["Integrations"],
    responses: {
      410: {
        description: "Xero integration removed",
      },
    },
  }),
  async () => {
    throw new HTTPException(410, {
      message: "Xero integration has been removed. Please use QuickBooks or Fortnox.",
    });
  },
);

export { app as installUrlRouter };
