import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // These fixtures must never reach the production app or a provider.
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort(),
  );
});

test("editor typing and selection formatting do not enter an update loop", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/checks");
  const editor = page.locator('[contenteditable="true"]');
  await editor.fill("Synthetic invoice description");
  await editor.press("ControlOrMeta+A");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await expect(page.getByLabel("Editor content")).toContainText('"type":"bold"');
  await editor.press("ArrowRight");
  await editor.pressSequentially(" checked");
  await expect(page.getByLabel("Editor content")).toContainText("checked");
  expect(errors).toEqual([]);
});

test("HMRC device ID persists while observed viewport values change", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto("/checks");
  await page.getByRole("button", { name: "Collect browser data" }).click();
  const first = JSON.parse(await page.getByLabel("Collected browser data").innerText());
  expect(first.deviceId).toMatch(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
  expect(first.window).toEqual({ width: 1000, height: 700 });
  expect(first).not.toHaveProperty("publicIp");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("button", { name: "Collect browser data" }).click();
  const second = JSON.parse(await page.getByLabel("Collected browser data").innerText());
  expect(second.deviceId).toBe(first.deviceId);
  expect(second.window).toEqual({ width: 390, height: 844 });
});
