import { expect, test, type Page } from "@playwright/test";
import { getAppBaseUrl, getWebsiteBaseUrl, resolveTestUrl } from "./helpers/hosts";

const appBaseUrl = getAppBaseUrl();
const websiteBaseUrl = getWebsiteBaseUrl();

test.use({ storageState: { cookies: [], origins: [] } });

test("legacy website host redirects to the canonical app host", async ({
  page,
}) => {
  await page.goto(resolveTestUrl(websiteBaseUrl, "/"));
  await expect(page).toHaveURL(resolveTestUrl(appBaseUrl, "/login"));

  await page.goto(resolveTestUrl(websiteBaseUrl, "/login"));
  await expect(page).toHaveURL(resolveTestUrl(appBaseUrl, "/login"));
  await expect(page.getByRole("heading", { name: "Welcome to Tamias" })).toBeVisible({
    timeout: 30_000,
  });

  await page.goto(resolveTestUrl(websiteBaseUrl, "/dashboard"));
  await expect(page).toHaveURL(
    new RegExp(`^${appBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/login\\?return_to=dashboard$`),
  );

  const token = "missing-public-token";

  await page.goto(resolveTestUrl(websiteBaseUrl, `/i/${token}`));

  await expect(page).toHaveURL(resolveTestUrl(appBaseUrl, `/i/${token}`));
  await expect(page.getByText("Page not found")).toBeVisible({
    timeout: 30_000,
  });
});
