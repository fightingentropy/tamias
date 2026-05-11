import { expect, type Page } from "@playwright/test";

/**
 * Switch the country selector in the bank connect modal.
 */
export async function switchCountryTo(page: Page, countryName: string) {
  // Click the country selector button (shows current country name)
  const countryButton = page.getByRole("button", { name: /United Kingdom/ });
  await countryButton.click();

  // Type in the country search within the popover
  const countrySearch = page.getByPlaceholder("Search country...");
  await countrySearch.waitFor({ state: "visible", timeout: 5_000 });
  await countrySearch.fill(countryName);

  // Click the matching country option
  await page.getByRole("option", { name: countryName }).click();

  // Wait for popover to close
  await expect(countrySearch).toBeHidden({ timeout: 5_000 });
}

/**
 * Search for a bank in the connect modal.
 */
export async function searchBank(page: Page, bankName: string) {
  const searchInput = page.getByPlaceholder("Search bank...");
  await searchInput.fill(bankName);

  // Wait for debounce (200ms) + network response
  await page.waitForTimeout(500);
}

/**
 * Click a bank search result by name to trigger connection.
 */
export async function connectToBank(page: Page, bankName: string) {
  // The search result is a div row containing the bank name
  const result = page.locator(`div:has(> div p:text-is("${bankName}"))`).first();
  await result.waitFor({ state: "visible", timeout: 15_000 });
  await result.click();
}

/**
 * Wait for the account selection modal to appear after provider OAuth completes.
 */
export async function waitForAccountSelectionModal(page: Page) {
  // URL should contain step=account
  await page.waitForURL(/step=account/, { timeout: 30_000 });

  // Wait for "Select Accounts" heading
  await expect(page.getByRole("heading", { name: "Select Accounts" })).toBeVisible({
    timeout: 30_000,
  });

  // Wait for at least one switch to appear (accounts loaded)
  await expect(page.getByRole("switch").first()).toBeVisible({ timeout: 30_000 });
}

/**
 * Click Save to submit selected accounts and start sync.
 */
export async function saveSelectedAccounts(page: Page) {
  const saveButton = page.getByRole("button", { name: "Save" });
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });
  await saveButton.click();
}

/**
 * Open the bank connect modal from the dashboard.
 */
export async function openBankConnectModal(page: Page) {
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await page.goto("/dashboard?step=connect", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Connect bank account" })).toBeVisible({
    timeout: 30_000,
  });
}
