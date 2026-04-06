import { test } from "@playwright/test";
import { readSmokeUserCredentials, signInWithPassword } from "./helpers/auth";
import { expectDashboardAssistantReady } from "./helpers/dashboard";

test.use({ storageState: { cookies: [], origins: [] } });

test("password auth signs an existing user into the dashboard", async ({
  page,
}) => {
  const credentials = await readSmokeUserCredentials();
  await signInWithPassword(page, credentials);
  await expectDashboardAssistantReady(page);
});
