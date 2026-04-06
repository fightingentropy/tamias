import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

const e2eRoot = path.join(process.cwd(), "e2e");

export interface SmokeUserCredentials {
  email: string;
  password: string;
}

export const AUTH_STATE_PATH = path.join(e2eRoot, ".auth", "user.json");
export const CREDENTIALS_PATH = path.join(e2eRoot, ".auth", "credentials.json");

export function createSmokeUserCredentials(): SmokeUserCredentials {
  const suffix = Date.now().toString(36);

  return {
    email: `playwright.${suffix}@example.com`,
    password: `Playwright!${suffix}123`,
  };
}

export async function saveSmokeUserCredentials(
  credentials: SmokeUserCredentials,
): Promise<void> {
  await mkdir(path.dirname(CREDENTIALS_PATH), { recursive: true });
  await writeFile(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2));
}

export async function readSmokeUserCredentials(): Promise<SmokeUserCredentials> {
  const file = await readFile(CREDENTIALS_PATH, "utf8");

  return JSON.parse(file) as SmokeUserCredentials;
}

export async function signUpWithPassword(
  page: Page,
  credentials: SmokeUserCredentials,
): Promise<void> {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page
    .getByRole("button", { name: "Need an account? Create one" })
    .click();
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect
    .poll(() => new URL(page.url()).pathname, {
      timeout: 30_000,
    })
    .not.toBe("/login");
}

async function selectOptionByTestId(
  page: Page,
  testId: string,
  optionLabel: string,
) {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name: optionLabel }).click();
}

export async function completeOnboarding(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { name: "Complete your profile" }),
  ).toBeVisible({
    timeout: 30_000,
  });
  const nameInput = page.getByTestId("onboarding-full-name");
  await nameInput.waitFor({ state: "visible" });
  await nameInput.click();
  await nameInput.fill("Playwright Smoke", { timeout: 60_000 });
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Business details" }),
  ).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("onboarding-company-name").fill("Playwright Ltd");
  await selectOptionByTestId(page, "onboarding-company-type", "Just exploring");
  await selectOptionByTestId(page, "onboarding-heard-about", "GitHub");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Connect your bank" }),
  ).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Skip for now" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Auto-match receipts to transactions",
    }),
  ).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Skip for now" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Prepare your books without friction",
    }),
  ).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Next" }).click();

  await expect(
    page.getByRole("heading", { name: "You're ready to go" }),
  ).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Get started" }).click();

  await expect(page).toHaveURL("/dashboard", { timeout: 30_000 });
}

export async function signInWithPassword(
  page: Page,
  credentials: SmokeUserCredentials,
): Promise<void> {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/dashboard", { timeout: 30_000 });
}
