import { expect, test, type Page } from "@playwright/test";
import {
  getAppBaseUrl,
  getWebsiteBaseUrl,
  resolveTestUrl,
} from "./helpers/hosts";

const appBaseUrl = getAppBaseUrl();
const websiteBaseUrl = getWebsiteBaseUrl();

test.use({ storageState: { cookies: [], origins: [] } });

async function gotoAllowRedirectAbort(page: Page, url: string) {
  try {
    await page.goto(url);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("net::ERR_ABORTED")) {
      throw error;
    }
  }
}

test("website host serves public routes and app host redirects website content to the canonical host", async ({
  page,
}) => {
  await page.goto(resolveTestUrl(websiteBaseUrl, "/pricing"));
  await expect(page).toHaveURL(resolveTestUrl(websiteBaseUrl, "/pricing"));
  await expect(
    page.getByRole("heading", {
      name: "Pricing that matches how you run your business",
    }),
  ).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(resolveTestUrl(appBaseUrl, "/pricing"));
  await expect(page).toHaveURL(resolveTestUrl(websiteBaseUrl, "/pricing"));

  await gotoAllowRedirectAbort(page, resolveTestUrl(appBaseUrl, "/site/pricing"));
  await expect(page).toHaveURL(resolveTestUrl(websiteBaseUrl, "/pricing"));

  await page.goto(resolveTestUrl(websiteBaseUrl, "/updates/page/2"));
  await expect(page).toHaveURL(resolveTestUrl(websiteBaseUrl, "/updates/page/2"));
  await expect(page).toHaveTitle(/Updates - Page 2/);
  await expect(page.getByRole("link", { name: "Previous" })).toBeVisible();
});

test("website host redirects app surfaces to the canonical app host", async ({
  page,
}) => {
  await page.goto(resolveTestUrl(websiteBaseUrl, "/login"));
  await expect(page).toHaveURL(resolveTestUrl(appBaseUrl, "/login"));
  await expect(page.getByRole("heading", { name: "Welcome to Tamias" })).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(resolveTestUrl(websiteBaseUrl, "/dashboard"));
  await expect(page).toHaveURL(
    new RegExp(`^${appBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/login\\?return_to=dashboard$`),
  );
});

test("public app paths redirect from the website host to the canonical app host", async ({
  page,
}) => {
  const token = "missing-public-token";

  await page.goto(resolveTestUrl(websiteBaseUrl, `/i/${token}`));

  await expect(page).toHaveURL(resolveTestUrl(appBaseUrl, `/i/${token}`));
  await expect(page.getByText("Page not found")).toBeVisible({
    timeout: 30_000,
  });
});
