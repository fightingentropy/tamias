import { expect, test } from "@playwright/test";
import {
  AUTH_STATE_PATH,
  createSmokeUserCredentials,
  saveSmokeUserCredentials,
  signUpWithPassword,
} from "./helpers/auth";
import { ensureSmokeUserProfile } from "./helpers/convex";

test("create authenticated smoke user", async ({ page }) => {
  const credentials = createSmokeUserCredentials();

  await signUpWithPassword(page, credentials);
  await ensureSmokeUserProfile(credentials.email);
  await page.goto("/dashboard");
  await expect(
    page.locator('textarea[placeholder="Ask anything"]:visible'),
  ).toBeVisible({
    timeout: 30_000,
  });
  await saveSmokeUserCredentials(credentials);
  await page.context().storageState({ path: AUTH_STATE_PATH });
});
