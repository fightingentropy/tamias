import { test } from "@playwright/test";
import {
  AUTH_STATE_PATH,
  completeOnboarding,
  createSmokeUserCredentials,
  saveSmokeUserCredentials,
  signUpWithPassword,
} from "./helpers/auth";
import { expectDashboardAssistantReady } from "./helpers/dashboard";

test("create authenticated smoke user", async ({ page }) => {
  const credentials = createSmokeUserCredentials();

  await signUpWithPassword(page, credentials);
  await completeOnboarding(page);
  await expectDashboardAssistantReady(page);
  await saveSmokeUserCredentials(credentials);
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
