import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export interface SmokeUserCredentials {
  email: string;
  password: string;
}

export const AUTH_STATE_PATH = path.join(
  process.cwd(),
  "playwright/.auth/user.json",
);
export const CREDENTIALS_PATH = path.join(
  process.cwd(),
  "playwright/.auth/credentials.json",
);

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
