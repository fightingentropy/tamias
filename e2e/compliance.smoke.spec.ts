import { expect, test } from "@playwright/test";

test("compliance overview and VAT setup render without a filing profile", async ({ page }) => {
  await page.goto("/compliance");
  await expect(page.getByRole("heading", { name: "Compliance" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Profile not configured").first()).toBeVisible({
    timeout: 30_000,
  });

  await page.goto("/compliance/vat");
  await expect(page.getByText("Set up your UK filing profile first")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("link", { name: "Open compliance settings" })).toBeVisible();
});
