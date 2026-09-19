import { test, expect, type Page } from "@playwright/test";
import { createCisSelfAssessmentFixture } from "../../scripts/self-assessment-fixture";
import type {
  TaxConnection,
  TaxFiling,
  TaxReport,
} from "../../dashboard/src/components/compliance/self-assessment-types";

const fixture = createCisSelfAssessmentFixture();
function state() {
  return {
    report: { ...structuredClone(fixture.report), fingerprint: "fixture-records" } as TaxReport,
    connection: {
      environment: "production",
      ready: true,
      blockers: [],
      supportedTaxYear: 2025,
    } as TaxConnection,
    filings: [] as TaxFiling[],
    submissions: [] as Record<string, unknown>[],
    profiles: [] as TaxReport["profile"][],
    failSubmission: false,
  };
}
function prepared(s: ReturnType<typeof state>): TaxFiling {
  return {
    id: "fictional-return",
    environment: s.connection.environment,
    status: "prepared",
    fingerprint: s.report.fingerprint,
    irMark: fixture.irMarkDisplay,
    correlationId: null,
    createdAt: "2026-09-19T09:00:00Z",
    nextPollAt: null,
    receipt: null,
    identity: fixture.identity,
    calculation: fixture.calculation,
  };
}
async function mount(page: Page, s: ReturnType<typeof state>) {
  // Every data request is intercepted locally, including the submission endpoint.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4178)/, (route) => route.abort());
  await page.route("**/fixture-api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.method() === "GET" ? undefined : request.postDataJSON();
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (path.endsWith("/report")) return reply(s.report);
    if (path.endsWith("/submissions")) return reply({ connection: s.connection, data: s.filings });
    if (path.endsWith("/profile")) {
      expect(request.method()).toBe("PUT");
      s.profiles.push(body);
      s.report.profile = body;
      s.report.filingBlockers = body.additionalSections.length
        ? ["Additional return sections need another filing route."]
        : [];
      return reply(s.report);
    }
    if (path.endsWith("/prepare")) {
      expect(request.method()).toBe("POST");
      expect(body.fingerprint).toBe(s.report.fingerprint);
      s.filings = [{ ...prepared(s), identity: body.identity }];
      return reply(s.filings[0]);
    }
    if (path.endsWith("/submit")) {
      expect(request.method()).toBe("POST");
      s.submissions.push(body);
      s.filings[0] = {
        ...s.filings[0],
        status: s.failSubmission ? "unknown" : "acknowledged",
        correlationId: "fictional-correlation",
        nextPollAt: "2020-01-01T00:00:00Z",
      };
      if (s.failSubmission) return route.abort("timedout");
      return reply(s.filings[0]);
    }
    if (path.endsWith("/poll")) {
      s.filings[0] = {
        ...s.filings[0],
        status: "accepted",
        receipt: {
          status: "accepted",
          summary: "HMRC accepted this fictional return.",
          errors: [],
          irMarkMatched: true,
        } as TaxFiling["receipt"],
      };
      return reply(s.filings[0]);
    }
    if (path.endsWith("/evidence")) return reply({ filing: s.filings[0] });
    throw new Error(`Unexpected fixture request: ${request.method()} ${path}`);
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: s.report.profile.filedElsewhere
        ? "Return already filed"
        : s.report.taxYear === 2026
          ? "Your next Self Assessment"
          : "File your Self Assessment",
    }),
  ).toBeVisible();
}
async function credentials(page: Page) {
  await page.getByLabel("Government Gateway user ID", { exact: true }).fill("fictional-user");
  await page.getByLabel("Government Gateway password", { exact: true }).fill("fictional-password");
  await page.getByLabel("I declare that this return").check();
}

test("prepare, review, explicitly submit once, then verify the receipt", async ({ page }) => {
  const s = state();
  await mount(page, s);
  await page.getByRole("button", { name: "Prepare return for review" }).click();
  const dialog = page.getByRole("dialog");
  const save = dialog.getByRole("button", { name: "Save return for review" });
  await expect(save).toBeDisabled();
  await dialog.getByLabel("Full name", { exact: true }).fill("Example Taxpayer");
  await dialog.getByLabel("Unique Taxpayer Reference (UTR)").fill("1234567890");
  await dialog.getByLabel("National Insurance number").fill("AB123456C");
  await dialog.getByLabel("Date of birth").fill("1990-01-01");
  await dialog.getByLabel("Taxpayer status").selectOption("U");
  await dialog
    .getByRole("combobox", { name: "Class 2 National Insurance", exact: true })
    .selectOption("not_needed");
  for (const checkbox of await dialog.getByRole("checkbox").all()) await checkbox.check();
  await save.click();
  await expect(page.getByText("Prepared · not submitted", { exact: true })).toBeVisible();
  await expect(page.getByText("£959.16", { exact: true })).toBeVisible();
  await expect(page.getByText("CIS tax already deducted")).toBeVisible();
  const submit = page.getByRole("button", { name: "Submit return to HMRC", exact: true });
  await expect(submit).toBeDisabled();
  await credentials(page);
  await submit.click();
  expect(s.submissions).toHaveLength(0);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  expect(s.submissions).toHaveLength(0);
  await submit.click();
  await page.getByRole("button", { name: "Confirm submission to HMRC" }).click();
  await expect(
    page.getByText("Received by HMRC · awaiting acceptance", { exact: true }),
  ).toBeVisible();
  expect(s.submissions).toEqual([
    {
      declarationAccepted: true,
      confirmedIrMark: fixture.irMarkDisplay,
      senderId: "fictional-user",
      password: "fictional-password",
    },
  ]);
  await expect(page.getByLabel("Government Gateway password", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Check HMRC status", exact: true }).click();
  await expect(page.getByText("Accepted by HMRC", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare return for review" })).toBeDisabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download return and receipt" }).click();
  expect((await download).suggestedFilename()).toContain("accepted");
  expect(s.submissions).toHaveLength(1);
});

test("an interrupted submission clears credentials and requires status checks", async ({
  page,
}) => {
  const s = state();
  s.filings = [prepared(s)];
  s.failSubmission = true;
  await mount(page, s);
  await credentials(page);
  await page.getByRole("button", { name: "Submit return to HMRC", exact: true }).click();
  await page.getByRole("button", { name: "Confirm submission to HMRC" }).click();
  await expect(page.getByRole("alert")).toContainText("return may have been received");
  await expect(page.getByLabel("Government Gateway password", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Submit return to HMRC", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Refresh submission status" }).click();
  await expect(page.getByText("Submission outcome needs checking", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Check HMRC status", exact: true }).click();
  await expect(page.getByText("Accepted by HMRC", { exact: true })).toBeVisible();
  expect(s.submissions).toHaveLength(1);
});

test("changed records prevent submitting an old draft", async ({ page }) => {
  const s = state();
  s.filings = [prepared(s)];
  await mount(page, s);
  await credentials(page);
  s.report.fingerprint = "updated-records";
  await page.getByRole("button", { name: "Refresh records" }).click();
  await expect(page.getByRole("alert")).toContainText("records or HMRC connection changed");
  await expect(
    page.getByRole("button", { name: "Submit return to HMRC", exact: true }),
  ).toHaveCount(0);
  expect(s.submissions).toHaveLength(0);
});

test("workspace switching clears entered credentials and declarations", async ({ page }) => {
  const s = state();
  s.filings = [prepared(s)];
  await mount(page, s);
  await credentials(page);
  await page.getByRole("button", { name: "Switch workspace" }).click();
  await expect(page.getByLabel("Government Gateway password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Government Gateway user ID", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("I declare that this return")).not.toBeChecked();
  expect(s.submissions).toHaveLength(0);
});

test("blocked reports and additional sections stay blocked", async ({ page }) => {
  const s = state();
  s.report.filingBlockers = ["Review one remaining transaction."];
  s.report.needsReview = 1;
  await mount(page, s);
  await expect(page.getByRole("button", { name: "Prepare return for review" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Review transactions" })).toHaveAttribute(
    "href",
    "#tax-transactions",
  );
  await page.getByText("Your business and return status", { exact: true }).click();
  await page.getByLabel("Capital gains, including crypto", { exact: true }).check();
  await page.getByRole("button", { name: "Save return checks" }).click();
  await expect(
    page.getByText("Additional return sections need another filing route.", { exact: true }),
  ).toBeVisible();
  expect(s.profiles[0].additionalSections).toEqual(["capital_gains"]);
  await expect(page.getByRole("button", { name: "Prepare return for review" })).toBeDisabled();
});

test("test drafts cannot be sent to the live service", async ({ page }) => {
  const s = state();
  s.filings = [{ ...prepared(s), environment: "test" }];
  await mount(page, s);
  await expect(
    page.getByText("Test return · does not fulfil your filing obligation"),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("HMRC connection changed");
  await expect(page.getByRole("button", { name: "Send test return", exact: true })).toHaveCount(0);
});

test("test mode and the mobile return remain readable", async ({ page }, testInfo) => {
  const s = state();
  s.connection.environment = "test";
  s.filings = [prepared(s)];
  await page.setViewportSize({ width: 390, height: 844 });
  await mount(page, s);
  await expect(page.getByText("Test service", { exact: true })).toBeVisible();
  await expect(page.getByText("Real filing is not enabled.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Government Gateway password", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: testInfo.outputPath("self-assessment-mobile.png"),
    fullPage: true,
  });
});

test("an externally filed year keeps records without another submission", async ({ page }) => {
  const s = state();
  s.filings = [prepared(s)];
  s.report.profile.filedElsewhere = true;
  await mount(page, s);
  await expect(
    page.getByText("Filed elsewhere · your confirmation", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare return for review" })).toHaveCount(0);
  await expect(page.getByLabel("Government Gateway password", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Submit return to HMRC", exact: true }),
  ).toHaveCount(0);
  expect(s.submissions).toHaveLength(0);
});

test("the current year is for recordkeeping and does not claim live filing support", async ({
  page,
}) => {
  const s = state();
  s.report.taxYear = 2026;
  s.report.label = "2026/27";
  s.report.start = "2026-04-06";
  s.report.endExclusive = "2027-04-06";
  s.report.generatedAt = "2026-09-19T10:00:00Z";
  await mount(page, s);
  await expect(page.getByText("Tax year in progress", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Filing for 2026/27 is not available in Tamias yet.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("You can file this tax year from 6 April 2027.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Live filing enabled", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Prepare return for review" })).toHaveCount(0);
});

test("statement analytics shows cash separately from spending and links to source transactions on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:4178)/, (route) => route.abort());
  await page.route("**/fixture-api/statement", (route) =>
    route.fulfill({
      json: {
        currency: "GBP",
        from: "2025-04-06",
        to: "2026-04-05",
        summary: {
          count: 18,
          firstDate: "2025-04-06",
          lastDate: "2026-04-05",
          moneyIn: 1210,
          moneyOut: 425,
          spending: 165,
          netMovement: 785,
          transfersIn: 200,
          transfersOut: 240,
          excludedIn: 0,
          excludedOut: 20,
          uncategorizedCount: 1,
          unconvertedCount: 0,
          unconvertedCurrencies: null,
        },
        months: [{ month: "2025-04", moneyIn: 1210, moneyOut: 425 }],
        categories: [
          { slug: "tools", name: "Tools & equipment", amount: 140, percentage: 84.85, count: 10 },
          { slug: "uncategorized", name: "Uncategorized", amount: 25, percentage: 15.15, count: 1 },
        ],
        merchants: [{ name: "Example Tools", amount: 140, count: 10 }],
      },
    }),
  );
  await page.goto("/statement");
  await expect(page.getByRole("heading", { name: "Money in", exact: true })).toBeVisible();
  await expect(page.getByText("£165.00", { exact: true })).toBeVisible();
  await expect(page.getByText("Transfers out", { exact: false })).toContainText("£240.00");
  const category = page.getByRole("link", { name: /Tools & equipment/ });
  await expect(category).toHaveAttribute(
    "href",
    "/transactions?start=2025-04-06&end=2026-04-05&accounts=example-account&categories=tools&type=expense",
  );
  await page.getByText("View monthly amounts and transactions", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Apr 2025", exact: true })).toHaveAttribute(
    "href",
    "/transactions?start=2025-04-06&end=2025-04-30&accounts=example-account",
  );
  await expect(page.getByRole("link", { name: /Example Tools/ })).toHaveAttribute(
    "href",
    "/transactions?start=2025-04-06&end=2026-04-05&accounts=example-account&q=Example+Tools&type=expense",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
