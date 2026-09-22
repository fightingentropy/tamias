import { beforeEach, expect, test } from "bun:test";
import { reportsRouter } from "../../rest/routers/reports";
import { createTestApp } from "../helpers";
import { mocks } from "../setup";

const report = {
  currency: "GBP",
  from: "2024-02-01",
  to: "2026-09-22",
  summary: {
    count: 73,
    firstDate: "2024-02-01",
    lastDate: "2026-09-16",
    moneyIn: 2000,
    moneyOut: 700,
    netMovement: 1300,
    spending: 200,
    transfersIn: 400,
    transfersOut: 500,
    excludedIn: 0,
    excludedOut: 0,
    uncategorizedCount: 0,
    unconvertedCount: 1,
    unconvertedCurrencies: "EUR",
  },
  months: [{ month: "2026-09", moneyIn: 2000, moneyOut: 700 }],
  categories: [{ slug: "tools", name: "Tools", amount: 200, count: 2, percentage: 100 }],
  merchants: [{ name: "Tool shop", amount: 200, count: 2 }],
};

function app(scopes: ["reports.read"] | [] = ["reports.read"]) {
  const app = createTestApp({ teamId: "authenticated-team", scopes });
  app.route("/reports", reportsRouter);
  return app;
}

beforeEach(() => {
  mocks.getStatementAnalytics.mockReset();
  mocks.getStatementAnalytics.mockResolvedValue(report);
});

test("statement analytics use the authenticated team and preserve complete history", async () => {
  const response = await app().request(
    "/reports/statement?currency=GBP&to=2026-09-22&teamId=other-team",
  );
  expect(response.status).toBe(200);
  expect(await response.json<typeof report>()).toEqual(report);
  expect(mocks.getStatementAnalytics).toHaveBeenCalledWith(expect.anything(), {
    teamId: "authenticated-team",
    currency: "GBP",
    to: "2026-09-22",
  });
});

test("statement analytics require report read permission", async () => {
  expect((await app([]).request("/reports/statement")).status).toBe(403);
  expect(mocks.getStatementAnalytics).not.toHaveBeenCalled();
});

test("statement analytics reject invalid date ranges before querying", async () => {
  expect((await app().request("/reports/statement?from=2026-09-22&to=2026-01-01")).status).toBe(
    400,
  );
  expect((await app().request("/reports/statement?accountId=invalid")).status).toBe(400);
  expect(mocks.getStatementAnalytics).not.toHaveBeenCalled();
});

test("failed statement queries remain errors instead of an empty successful report", async () => {
  mocks.getStatementAnalytics.mockRejectedValue(new Error("private database failure"));
  const response = await app().request("/reports/statement");
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private database failure");
});
