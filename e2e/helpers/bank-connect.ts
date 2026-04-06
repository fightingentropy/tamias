import { expect, type FrameLocator, type Page } from "@playwright/test";

/**
 * Switch the country selector in the bank connect modal.
 */
export async function switchCountryTo(page: Page, countryName: string) {
  // Click the country selector button (shows current country name)
  const countryButton = page.getByRole("button", { name: /United Kingdom|United States|Canada/ });
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
 * Wait for the Plaid Link iframe to appear and return a FrameLocator.
 */
export async function waitForPlaidIframe(page: Page): Promise<FrameLocator> {
  // Plaid Link uses an iframe with an id starting with "plaid-link-iframe"
  const iframeSelector = 'iframe[id^="plaid-link-iframe"]';
  await page.waitForSelector(iframeSelector, { state: "visible", timeout: 30_000 });
  return page.frameLocator(iframeSelector);
}

/**
 * Navigate through the Plaid sandbox flow inside the iframe.
 *
 * Plaid sandbox auto-fills credentials (user_good/pass_good).
 * The flow has multiple screens: consent, credentials, account selection, success.
 * We click through each "Continue"/"Submit" button.
 */
export async function completePlaidSandboxFlow(page: Page) {
  const plaidFrame = await waitForPlaidIframe(page);

  // Helper to click a button in the Plaid iframe by text
  async function clickPlaidButton(text: string | RegExp, timeout = 15_000) {
    const button = plaidFrame.getByRole("button", { name: text });
    await button.waitFor({ state: "visible", timeout });
    await button.click();
  }

  // Screen 1: Consent / "Continue" or "Agree and continue"
  try {
    await clickPlaidButton(/continue/i, 20_000);
  } catch {
    // Some Plaid flows skip the consent screen
  }

  // Screen 2: Credentials — sandbox auto-fills user_good/pass_good
  // Just need to click "Submit" or "Continue"
  try {
    await clickPlaidButton(/submit|continue/i, 15_000);
  } catch {
    // May auto-advance in sandbox
  }

  // Screen 3: Account selection — select accounts and continue
  try {
    await clickPlaidButton(/continue/i, 15_000);
  } catch {
    // May auto-advance
  }

  // Screen 4: Success — final "Continue" that fires onSuccess
  try {
    await clickPlaidButton(/continue/i, 15_000);
  } catch {
    // The iframe may close automatically
  }

  // Wait for Plaid iframe to disappear (onSuccess callback fired)
  await page
    .waitForSelector('iframe[id^="plaid-link-iframe"]', {
      state: "detached",
      timeout: 30_000,
    })
    .catch(() => {
      // Iframe may already be gone
    });
}

/**
 * Wait for the account selection modal to appear after Plaid Link completes.
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

/**
 * Full flow: open modal → switch to US → search → connect → complete Plaid → select accounts.
 * Returns when the account selection modal is showing.
 */
export async function connectPlaidSandboxBank(page: Page, bankName = "Platypus") {
  await openBankConnectModal(page);
  await switchCountryTo(page, "United States");
  await searchBank(page, bankName);
  await connectToBank(page, bankName);
  await completePlaidSandboxFlow(page);
  await waitForAccountSelectionModal(page);
}
