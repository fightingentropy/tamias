import { expect, test } from "@playwright/test";
import {
  openBankConnectModal,
  switchCountryTo,
  searchBank,
  connectToBank,
  completePlaidSandboxFlow,
  waitForAccountSelectionModal,
  saveSelectedAccounts,
  connectPlaidSandboxBank,
} from "./helpers/bank-connect";

test.describe("Plaid sandbox bank connection", () => {
  test("full Plaid sandbox bank connection flow", async ({ page }) => {
    test.setTimeout(120_000);

    // Step 1: Open connect modal
    await openBankConnectModal(page);

    // Step 2: Switch to US (Plaid sandbox institutions are US only)
    await switchCountryTo(page, "United States");

    // Step 3: Search for Platypus (Plaid sandbox bank)
    await searchBank(page, "Platypus");

    // Step 4: Verify search results show Platypus with Plaid provider
    const platypusResult = page.locator("text=Platypus").first();
    await expect(platypusResult).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("text=Via Plaid").first()).toBeVisible();

    // Step 5: Click the result to start Plaid Link
    await connectToBank(page, "Platypus");

    // Step 6: Complete Plaid sandbox flow (iframe interaction)
    await completePlaidSandboxFlow(page);

    // Step 7: Verify account selection modal appears
    await waitForAccountSelectionModal(page);

    // Step 8: Verify URL has correct params
    expect(page.url()).toContain("step=account");
    expect(page.url()).toContain("provider=plaid");

    // Step 9: Verify account list has toggle switches
    const switches = page.getByRole("switch");
    const switchCount = await switches.count();
    expect(switchCount).toBeGreaterThan(0);

    // Step 10: All accounts should default to enabled (checked)
    for (let i = 0; i < switchCount; i++) {
      await expect(switches.nth(i)).toBeChecked();
    }

    // Step 11: Save selected accounts
    await saveSelectedAccounts(page);

    // Step 12: Verify sync starts — "Setting up account" heading or loading tab
    // The tab switches to "loading" and shows LoadingTransactionsEvent
    await expect(
      page.getByText(/setting up|connecting|getting transactions|completed/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("sandbox institutions only appear for US country", async ({ page }) => {
    await openBankConnectModal(page);

    // Default country should be United Kingdom (team countryCode is GB)
    await expect(page.getByRole("button", { name: "United Kingdom" })).toBeVisible();

    // Search for Platypus with UK selected — should show no results or hint
    await searchBank(page, "Platypus");

    // Should show no results
    await expect(page.getByText("No banks found")).toBeVisible({ timeout: 10_000 });

    // Should show hint about US Plaid sandbox institutions
    await expect(page.getByText(/US Plaid sandbox institutions/i)).toBeVisible();

    // Switch to United States
    await switchCountryTo(page, "United States");

    // Now Platypus should appear
    await searchBank(page, "Platypus");
    await expect(page.locator("text=Platypus").first()).toBeVisible({ timeout: 15_000 });
  });

  test("account toggle validation — at least one must be selected", async ({ page }) => {
    test.setTimeout(120_000);

    // Get to account selection
    await connectPlaidSandboxBank(page);

    // All switches should default to checked
    const switches = page.getByRole("switch");
    const switchCount = await switches.count();
    expect(switchCount).toBeGreaterThan(0);

    for (let i = 0; i < switchCount; i++) {
      await expect(switches.nth(i)).toBeChecked();
    }

    // Toggle all switches off
    for (let i = 0; i < switchCount; i++) {
      await switches.nth(i).click();
    }

    // Save button should be disabled (form invalid — no accounts selected)
    const saveButton = page.getByRole("button", { name: "Save" });
    await expect(saveButton).toBeDisabled({ timeout: 5_000 });

    // Toggle one back on
    await switches.first().click();

    // Save button should be enabled again
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });
  });

  test("multiple sandbox institutions are searchable", async ({ page }) => {
    await openBankConnectModal(page);
    await switchCountryTo(page, "United States");

    // Test multiple Plaid sandbox institution names
    for (const bankName of ["Platypus", "Tartan"]) {
      await searchBank(page, bankName);
      await expect(page.locator(`text=${bankName}`).first()).toBeVisible({ timeout: 15_000 });
    }
  });
});
