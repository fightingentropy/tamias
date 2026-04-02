import { expect, type Page } from "@playwright/test";

export async function expectDashboardAssistantReady(page: Page) {
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
