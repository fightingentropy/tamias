import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test } from "bun:test";

test("all production REST routers generate an OpenAPI document without service mocks", () => {
  // Route suites replace service exports globally; generate from an isolated process so
  // this covers the complete production registry and its original schema definitions.
  const result = spawnSync(
    process.execPath,
    [
      "--no-env-file",
      "-e",
      `import { routers } from "./src/rest/routers";
const document = routers.getOpenAPIDocument({
  openapi: "3.1.0",
  info: { title: "Tamias API", version: "1.0.0" },
});
console.log(JSON.stringify(Object.keys(document.paths ?? {})));`,
    ],
    { cwd: resolve(import.meta.dir, "../.."), encoding: "utf8" },
  );
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  const paths = JSON.parse(result.stdout) as string[];
  expect(paths).toEqual(
    expect.arrayContaining([
      "/users/me",
      "/transactions",
      "/reports/statement",
      "/transaction-categories",
      "/inbox/uploads",
      "/inbox/uploads/complete",
      "/inbox/{id}/process",
      "/inbox/{id}/matches",
      "/inbox/{id}/match",
      "/invoices/{id}/draft",
      "/invoices/{id}/issue",
      "/self-assessment/{taxYear}",
      "/self-assessment/{taxYear}/reviews",
      "/self-assessment/{taxYear}/prepare",
      "/self-assessment/{taxYear}/submissions/{id}/submit",
    ]),
  );
});
