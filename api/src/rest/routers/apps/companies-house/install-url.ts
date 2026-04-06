import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  buildCompaniesHouseScope,
  COMPANIES_HOUSE_PROFILE_SCOPE,
  COMPANIES_HOUSE_SCOPE_KINDS,
  CompaniesHouseProvider,
  encryptComplianceOAuthState,
  isCompaniesHouseCompanyScopeKind,
} from "@tamias/compliance";
import { HTTPException } from "hono/http-exception";
import { protectedMiddleware } from "../../../middleware";
import type { Context } from "../../../types";

const app = new OpenAPIHono<Context>();

const installUrlQuerySchema = z.object({
  companyNumber: z.string().trim().min(1).max(20).optional(),
  scopeKind: z.enum(COMPANIES_HOUSE_SCOPE_KINDS).optional(),
});

const installUrlResponseSchema = z.object({
  url: z.string().url(),
});

app.use("*", ...protectedMiddleware);

app.openapi(
  createRoute({
    method: "get",
    path: "/",
    summary: "Get Companies House install URL",
    operationId: "getCompaniesHouseInstallUrl",
    description:
      "Generates OAuth install URL for the Companies House integration. Requires authentication.",
    tags: ["Integrations"],
    request: {
      query: installUrlQuerySchema,
    },
    responses: {
      200: {
        description: "Companies House install URL",
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
    const { companyNumber, scopeKind } = c.req.valid("query");

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

    if (!scopeKind && companyNumber) {
      throw new HTTPException(400, {
        message: "scopeKind must be provided when companyNumber is set",
      });
    }

    if (scopeKind && isCompaniesHouseCompanyScopeKind(scopeKind) && !companyNumber) {
      throw new HTTPException(400, {
        message: "companyNumber is required for company-specific scope requests",
      });
    }

    const state = encryptComplianceOAuthState({
      teamId: session.teamId,
      convexUserId: session.user.convexId,
      provider: "companies-house",
      source: "apps",
    });

    const scopes: string[] = [COMPANIES_HOUSE_PROFILE_SCOPE];

    if (scopeKind) {
      scopes.push(
        buildCompaniesHouseScope({
          companyNumber,
          scopeKind,
        }),
      );
    }

    try {
      const provider = CompaniesHouseProvider.fromEnvironment();
      const url = provider.buildConsentUrl(state, { scopes });
      return c.json({ url });
    } catch (error) {
      throw new HTTPException(500, {
        message:
          error instanceof Error ? error.message : "Companies House OAuth configuration missing",
      });
    }
  },
);

export { app as installUrlRouter };
