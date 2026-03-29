import { expect, test } from "@playwright/test";

test("authenticated user can move between dashboard, transactions, and invoices", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(
    page.locator('textarea[placeholder="Ask anything"]:visible'),
  ).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/transactions");
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByText("No transactions")).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/invoices");
  await expect(page).toHaveURL(/\/invoices$/);
  await expect(page.getByRole("heading", { name: "No invoices" })).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/dashboard");
  await expect(page).toHaveURL("/dashboard");
  await expect(
    page.locator('textarea[placeholder="Ask anything"]:visible'),
  ).toBeVisible({
    timeout: 30_000,
  });
});
