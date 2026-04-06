import { expect, test } from "@playwright/test";

test("connect bank modal opens with UK-first search (Plaid sandbox path)", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await page.goto("/dashboard?step=connect", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Connect bank account" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByPlaceholder("Search bank...")).toBeVisible();
  await expect(page.getByRole("button", { name: "United Kingdom" })).toBeVisible();
});
