import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createTestApp } from "../helpers";
const getReport = mock(async () => ({
  taxYear: 2025,
  fingerprint: "a".repeat(64),
  incomePence: 0,
  expensesPence: 0,
  profitPence: 0,
  blockers: [],
  transactions: [],
}));
const listFilings = mock(async (_db: unknown, _args: unknown) => ({
  data: [],
  connection: { environment: "test", ready: false, blockers: ["HMRC setup is incomplete"] },
}));
const prepare = mock(async () => ({ id: "fixture", status: "prepared" }));
const submit = mock(async () => ({ id: "fixture", status: "acknowledged" }));
const reports = await import("@tamias/app-data/queries/self-assessment");
const filings = await import("@tamias/app-data/queries/self-assessment-filings");
mock.module("@tamias/app-data/queries/self-assessment", () => ({
  ...reports,
  getSelfAssessmentReport: getReport,
}));
mock.module("@tamias/app-data/queries/self-assessment-filings", () => ({
  ...filings,
  listSelfAssessmentFilings: listFilings,
  prepareSelfAssessment: prepare,
  submitSelfAssessment: submit,
}));
const { selfAssessmentRouter } = await import("../../rest/routers/self-assessment");
function app(scopes: NonNullable<Parameters<typeof createTestApp>[0]>["scopes"]) {
  const app = createTestApp({ scopes });
  app.route("/self-assessment", selfAssessmentRouter);
  return app;
}
function post(body: unknown) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
beforeEach(() => {
  getReport.mockClear();
  listFilings.mockClear();
  prepare.mockClear();
  submit.mockClear();
});
describe("Self Assessment REST boundary", () => {
  test("transaction access does not grant access to personal filing records", async () => {
    const client = app(["transactions.read", "transactions.write"]);
    expect((await client.request("/self-assessment/2025")).status).toBe(200);
    expect((await client.request("/self-assessment/2025/submissions")).status).toBe(403);
    expect((await client.request("/self-assessment/2025/prepare", post({}))).status).toBe(403);
    expect(listFilings).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });
  test("filing reads use the authenticated workspace and return uncached connection readiness", async () => {
    const response = await app(["filings.read"]).request("/self-assessment/2025/submissions");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(((await response.json()) as { connection: { ready: boolean } }).connection.ready).toBe(
      false,
    );
    expect(listFilings.mock.calls[0]?.[1]).toEqual({
      teamId: "test-team-id",
      taxYear: 2025,
      userId: "test-user-id",
    });
  });
  test("a submission requires an exact return reference and an affirmative declaration", async () => {
    const client = app(["filings.write"]);
    const path = "/self-assessment/2025/submissions/12345678-1234-4123-a123-123456789012/submit";
    expect(
      (
        await client.request(
          path,
          post({ declarationAccepted: false, confirmedIrMark: "A".repeat(32) }),
        )
      ).status,
    ).toBe(400);
    expect(submit).not.toHaveBeenCalled();
    expect(
      (
        await client.request(
          path,
          post({ declarationAccepted: true, confirmedIrMark: "A".repeat(32) }),
        )
      ).status,
    ).toBe(200);
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
