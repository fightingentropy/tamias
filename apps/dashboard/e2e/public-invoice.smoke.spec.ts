import { expect, test } from "@playwright/test";
import { getInvoiceTokenByNumber } from "./helpers/convex";

test("seeded public invoice page renders from its signed token", async ({
  page,
}) => {
  const token = await getInvoiceTokenByNumber("INV-2026-002");

  await page.goto(`/i/${token}`);

  await expect(page).toHaveTitle(/INV-2026-002/);
  await expect(page.getByText("Powered by")).toBeVisible({
    timeout: 30_000,
  });
});
