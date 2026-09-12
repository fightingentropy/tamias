import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  getSelfAssessmentReport,
  reviewSelfAssessmentTransactions,
  saveSelfAssessmentProfile,
  SelfAssessmentConflict,
} from "@tamias/app-data/queries/self-assessment";
import {
  SelfAssessmentProfileSchema,
  SelfAssessmentIdentitySchema,
  SelfAssessmentFilingError,
  TaxReviewBatchSchema,
  TaxYearSchema,
  selfAssessmentCSV,
} from "@tamias/compliance";
import {
  listSelfAssessmentFilings,
  prepareSelfAssessment,
  submitSelfAssessment,
  pollSelfAssessment,
  selfAssessmentEvidence,
} from "@tamias/app-data/queries/self-assessment-filings";
import { withRequiredScope } from "../middleware/scope";
import type { Context } from "../types";

const app = new OpenAPIHono<Context>();
const params = z.object({ taxYear: TaxYearSchema });
const reportSchema = z
  .object({
    taxYear: z.number(),
    fingerprint: z.string(),
    incomePence: z.number(),
    expensesPence: z.number(),
    profitPence: z.number(),
    blockers: z.array(z.string()),
    transactions: z.array(z.unknown()),
  })
  .passthrough();
const responses = {
  200: {
    description: "Complete tax-year working papers",
    content: { "application/json": { schema: reportSchema } },
  },
  409: {
    description: "Tax records need refreshing",
    content: {
      "application/json": { schema: z.object({ code: z.string(), description: z.string() }) },
    },
  },
};
app.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  await next();
});
app.onError((error, c) => {
  if (error instanceof SelfAssessmentConflict)
    return c.json({ code: "tax_review_changed", description: error.message }, 409);
  if (error instanceof SelfAssessmentFilingError)
    return c.json({ code: "tax_filing_unavailable", description: error.message }, 400);
  throw error;
});
app.openapi(
  createRoute({
    method: "get",
    path: "/{taxYear}",
    tags: ["Self Assessment"],
    operationId: "getSelfAssessment",
    request: { params },
    responses,
    middleware: [withRequiredScope("transactions.read")],
  }),
  async (c) => {
    return c.json(
      await getSelfAssessmentReport(c.get("db"), {
        teamId: c.get("teamId"),
        taxYear: c.req.valid("param").taxYear,
      }),
      200,
    );
  },
);
app.openapi(
  createRoute({
    method: "put",
    path: "/{taxYear}/profile",
    tags: ["Self Assessment"],
    operationId: "saveSelfAssessmentProfile",
    request: {
      params,
      body: { content: { "application/json": { schema: SelfAssessmentProfileSchema } } },
    },
    responses,
    middleware: [withRequiredScope("transactions.write")],
  }),
  async (c) => {
    return c.json(
      await saveSelfAssessmentProfile(c.get("db"), {
        teamId: c.get("teamId"),
        userId: c.get("session").user.id,
        taxYear: c.req.valid("param").taxYear,
        profile: c.req.valid("json"),
      }),
      200,
    );
  },
);
app.openapi(
  createRoute({
    method: "put",
    path: "/{taxYear}/reviews",
    tags: ["Self Assessment"],
    operationId: "reviewSelfAssessmentTransactions",
    request: {
      params,
      body: { content: { "application/json": { schema: TaxReviewBatchSchema } } },
    },
    responses,
    middleware: [withRequiredScope("transactions.write")],
  }),
  async (c) => {
    return c.json(
      await reviewSelfAssessmentTransactions(c.get("db"), {
        teamId: c.get("teamId"),
        userId: c.get("session").user.id,
        taxYear: c.req.valid("param").taxYear,
        reviews: c.req.valid("json").reviews,
      }),
      200,
    );
  },
);
app.openapi(
  createRoute({
    method: "get",
    path: "/{taxYear}/export",
    tags: ["Self Assessment"],
    operationId: "exportSelfAssessment",
    request: { params, query: z.object({ fingerprint: z.string().length(64) }) },
    responses: {
      200: {
        description: "CSV working papers for the reviewed snapshot",
        content: {
          "application/json": {
            schema: z.object({ fileName: z.string(), csv: z.string(), fingerprint: z.string() }),
          },
        },
      },
      409: responses[409],
    },
    middleware: [withRequiredScope("transactions.read")],
  }),
  async (c) => {
    const report = await getSelfAssessmentReport(c.get("db"), {
      teamId: c.get("teamId"),
      taxYear: c.req.valid("param").taxYear,
    });
    if (report.fingerprint !== c.req.valid("query").fingerprint)
      throw new SelfAssessmentConflict(
        "Your tax records changed. Refresh the summary before exporting.",
      );
    return c.json(
      {
        fileName: `Tamias-Self-Assessment-${report.taxYear}-${report.taxYear + 1}.csv`,
        csv: selfAssessmentCSV(report),
        fingerprint: report.fingerprint,
      },
      200,
    );
  },
);
app.openapi(
  createRoute({
    method: "get",
    path: "/{taxYear}/submissions",
    tags: ["Self Assessment"],
    operationId: "getSelfAssessmentSubmissions",
    request: { params },
    responses: {
      200: {
        description: "HMRC submission receipts",
        content: {
          "application/json": {
            schema: z.object({
              data: z.array(z.unknown()),
              connection: z
                .object({
                  environment: z.string(),
                  ready: z.boolean(),
                  blockers: z.array(z.string()),
                })
                .passthrough(),
            }),
          },
        },
      },
    },
    middleware: [withRequiredScope("filings.read")],
  }),
  async (c) => {
    return c.json(
      await listSelfAssessmentFilings(c.get("db"), {
        teamId: c.get("teamId"),
        taxYear: c.req.valid("param").taxYear,
        userId: c.get("session").user.id,
      }),
    );
  },
);
const filingResponses = {
  200: {
    description: "Saved Self Assessment filing state",
    content: { "application/json": { schema: z.object({ id: z.string() }).passthrough() } },
  },
};
const filingParams = params.extend({ id: z.uuid() });
app.openapi(
  createRoute({
    method: "post",
    path: "/{taxYear}/prepare",
    tags: ["Self Assessment"],
    operationId: "prepareSelfAssessment",
    request: {
      params,
      body: {
        content: {
          "application/json": {
            schema: z.object({
              fingerprint: z.string().length(64),
              identity: SelfAssessmentIdentitySchema,
            }),
          },
        },
      },
    },
    responses: filingResponses,
    middleware: [withRequiredScope("filings.write")],
  }),
  async (c) => {
    return c.json(
      await prepareSelfAssessment(c.get("db"), {
        teamId: c.get("teamId"),
        userId: c.get("session").user.id,
        taxYear: c.req.valid("param").taxYear,
        ...c.req.valid("json"),
      }),
    );
  },
);
app.openapi(
  createRoute({
    method: "post",
    path: "/{taxYear}/submissions/{id}/submit",
    tags: ["Self Assessment"],
    operationId: "submitSelfAssessment",
    request: {
      params: filingParams,
      body: {
        content: {
          "application/json": {
            schema: z.object({
              declarationAccepted: z.literal(true),
              confirmedIrMark: z.string().length(32),
              senderId: z.string().min(1).max(100).optional(),
              password: z.string().min(1).max(100).optional(),
            }),
          },
        },
      },
    },
    responses: filingResponses,
    middleware: [withRequiredScope("filings.write")],
  }),
  async (c) => {
    return c.json(
      await submitSelfAssessment(c.get("db"), {
        teamId: c.get("teamId"),
        userId: c.get("session").user.id,
        ...c.req.valid("param"),
        ...c.req.valid("json"),
      }),
    );
  },
);
app.openapi(
  createRoute({
    method: "post",
    path: "/{taxYear}/submissions/{id}/poll",
    tags: ["Self Assessment"],
    operationId: "pollSelfAssessment",
    request: { params: filingParams },
    responses: filingResponses,
    middleware: [withRequiredScope("filings.write")],
  }),
  async (c) => {
    return c.json(
      await pollSelfAssessment(c.get("db"), {
        teamId: c.get("teamId"),
        userId: c.get("session").user.id,
        ...c.req.valid("param"),
      }),
    );
  },
);
app.openapi(
  createRoute({
    method: "get",
    path: "/{taxYear}/submissions/{id}/evidence",
    tags: ["Self Assessment"],
    operationId: "getSelfAssessmentEvidence",
    request: { params: filingParams },
    responses: {
      200: {
        description: "Original return and HMRC receipt without credentials",
        content: {
          "application/json": {
            schema: z.object({
              returnXml: z.string(),
              receiptXml: z.string().nullable(),
              submission: z.unknown(),
            }),
          },
        },
      },
    },
    middleware: [withRequiredScope("filings.read")],
  }),
  async (c) => {
    return c.json(
      await selfAssessmentEvidence(c.get("db"), {
        teamId: c.get("teamId"),
        userId: c.get("session").user.id,
        ...c.req.valid("param"),
      }),
    );
  },
);
export const selfAssessmentRouter = app;
