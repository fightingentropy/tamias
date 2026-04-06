import { expect, type Page } from "@playwright/test";

export async function expectDashboardAssistantReady(page: Page) {
  // Bank connect can open via URL params after onboarding; it mounts async — wait, then dismiss.
  const connectBankHeading = page.getByRole("heading", { name: "Connect your bank" });
  await connectBankHeading.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  if (await connectBankHeading.isVisible()) {
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(connectBankHeading).toBeHidden({ timeout: 15_000 });
  }

  const composer = page.locator('textarea[placeholder="Ask anything"]:visible');
  const openAssistantButton = page.getByRole("button", {
    name: "Open assistant",
  });

  if (await composer.isVisible().catch(() => false)) {
    await expect(composer).toBeVisible({
      timeout: 30_000,
    });
    return;
  }

  await expect(openAssistantButton).toBeVisible({
    timeout: 30_000,
  });
  await openAssistantButton.click();

  await expect(composer).toBeVisible({
    timeout: 30_000,
  });
}
