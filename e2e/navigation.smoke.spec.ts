import { expect, test } from "@playwright/test";
import { readSmokeUserCredentials, signInWithPassword } from "./helpers/auth";
import { expectDashboardAssistantReady } from "./helpers/dashboard";

test.use({ storageState: { cookies: [], origins: [] } });

test("authenticated user can move between dashboard, transactions, and invoices", async ({
  page,
}) => {
  const credentials = await readSmokeUserCredentials();

  await signInWithPassword(page, credentials);
  await expectDashboardAssistantReady(page);

  await page.goto("/transactions", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/transactions$/);
  // Assert route chrome (filters + tabs sit above the table error boundary).
  await expect(page.getByPlaceholder("Search transactions...")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("tab", { name: "All" })).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/invoices", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/invoices$/);
  await expect(page.getByPlaceholder("Search invoices...")).toBeVisible({
    timeout: 30_000,
  });
});
