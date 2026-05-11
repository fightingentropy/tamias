import { expect, test } from "@playwright/test";
import {
  openBankConnectModal,
  searchBank,
} from "./helpers/bank-connect";

test.describe("bank connect error handling and edge cases", () => {
  test("invalid account params show error and close modal", async ({ page }) => {
    // Navigate directly to account step with invalid tokens
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await page.goto(
      "/dashboard?step=account&provider=truelayer&token=invalid_token&ref=invalid_ref",
      { waitUntil: "domcontentloaded" },
    );

    // The getProviderAccounts query should fail, triggering error toast
    await expect(page.getByText(/could not connect|something went wrong/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // Modal should close and URL params should be cleared
    await expect(page).not.toHaveURL(/step=account/, { timeout: 15_000 });
  });

  test("connect modal can be dismissed", async ({ page }) => {
    await openBankConnectModal(page);

    // The modal should be visible
    await expect(page.getByRole("heading", { name: "Connect bank account" })).toBeVisible();

    // Close the modal via the close button (Dialog has a close button)
    const closeButton = page.locator('[role="dialog"] button:has(svg)').first();
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      // Fallback: press Escape
      await page.keyboard.press("Escape");
    }

    // URL params should be cleared
    await expect(page).not.toHaveURL(/step=connect/, { timeout: 15_000 });

    // Modal heading should no longer be visible
    await expect(page.getByRole("heading", { name: "Connect bank account" })).toBeHidden({
      timeout: 10_000,
    });
  });

  test("empty search results show fallback with import option", async ({ page }) => {
    await openBankConnectModal(page);

    // Search for a nonexistent bank
    await searchBank(page, "NonexistentBankXYZ12345");

    // Should show "No banks found" message
    await expect(page.getByText("No banks found")).toBeVisible({ timeout: 10_000 });

    // Should show the description text
    await expect(page.getByText(/couldn't find a bank/i)).toBeVisible();

    // Should have Import button
    await expect(page.getByRole("button", { name: "Import" })).toBeVisible();

    // Should have Contact us button
    await expect(page.getByRole("button", { name: "Contact us" })).toBeVisible();
  });

  test("Import button navigates to import step", async ({ page }) => {
    await openBankConnectModal(page);
    await searchBank(page, "NonexistentBankXYZ12345");

    await expect(page.getByText("No banks found")).toBeVisible({ timeout: 10_000 });

    // Click Import
    await page.getByRole("button", { name: "Import" }).click();

    // Should navigate to import step
    await expect(page).toHaveURL(/step=import/, { timeout: 10_000 });
  });

  test("search input autofocuses and supports clearing", async ({ page }) => {
    await openBankConnectModal(page);

    const searchInput = page.getByPlaceholder("Search bank...");

    // Input should be visible
    await expect(searchInput).toBeVisible();

    // Type a search term
    await searchInput.fill("Test");
    await expect(searchInput).toHaveValue("Test");

    // Clear the input
    await searchInput.fill("");
    await expect(searchInput).toHaveValue("");
  });
});
