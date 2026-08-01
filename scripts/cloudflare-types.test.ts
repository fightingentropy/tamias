import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "bun:test";

const repositoryRoot = path.resolve(import.meta.dir, "..");

describe("Cloudflare type generation", () => {
  test("builds the configured Worker entrypoint before Wrangler inspects it", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
    ) as {
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };
    const wranglerConfig = readFileSync(path.join(repositoryRoot, "wrangler.jsonc"), "utf8");
    const configuredMain = wranglerConfig.match(/"main"\s*:\s*"([^"]+)"/)?.[1];
    const generationCommand = packageJson.scripts["types:cloudflare"] ?? "";
    const buildIndex = generationCommand.indexOf("run --filter @tamias/dashboard build");
    const generateIndex = generationCommand.indexOf(
      "node_modules/.bin/wrangler types types/cloudflare-env.d.ts",
    );
    const sanitizeIndex = generationCommand.indexOf("scripts/sanitize-cloudflare-types.ts");
    const formatIndex = generationCommand.indexOf("prettier --write types/cloudflare-env.d.ts");

    expect(configuredMain).toBe("./dashboard/dist/server/index.mjs");
    expect(packageJson.devDependencies.wrangler).toBe("4.90.1");
    expect(buildIndex).toBeGreaterThanOrEqual(0);
    expect(generateIndex).toBeGreaterThan(buildIndex);
    expect(sanitizeIndex).toBeGreaterThan(generateIndex);
    expect(formatIndex).toBeGreaterThan(sanitizeIndex);
  });
});
