import { expect, test } from "@playwright/test";
import { readSmokeUserCredentials } from "./helpers/auth";

test.use({ storageState: { cookies: [], origins: [] } });

test("password auth signs an existing user into the dashboard", async ({
  page,
}) => {
  const credentials = await readSmokeUserCredentials();

  await page.goto("/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/dashboard", { timeout: 30_000 });
  await expect(
    page.locator('textarea[placeholder="Ask anything"]:visible'),
  ).toBeVisible({
    timeout: 30_000,
  });
});
