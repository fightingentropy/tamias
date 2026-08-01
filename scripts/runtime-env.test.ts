import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  assertNoUnexpectedSensitiveCredentials,
  loadRuntimeEnvironment,
  parseRuntimeEnvFile,
  runtimeEnvAllowlists,
} from "./lib/runtime-env";

describe("runtime environment boundaries", () => {
  test("accepts only keys allowed for the selected runtime", () => {
    const allowed = new Set<string>(runtimeEnvAllowlists.dashboard);

    expect(parseRuntimeEnvFile("DASHBOARD_URL=https://app.test\n", allowed)).toEqual({
      DASHBOARD_URL: "https://app.test",
    });
    expect(() => parseRuntimeEnvFile("HMRC_CT_SENDER_PASSWORD=secret\n", allowed)).toThrow(
      "not allowed for this runtime",
    );
  });

  test("fails closed when an unrelated credential is visible", () => {
    expect(() =>
      assertNoUnexpectedSensitiveCredentials(
        { DASHBOARD_URL: "https://app.test", STRIPE_SECRET_KEY: "secret" },
        new Set<string>(runtimeEnvAllowlists.dashboard),
      ),
    ).toThrow("STRIPE_SECRET_KEY");
  });

  test("never treats public configuration as a secret", () => {
    expect(() =>
      assertNoUnexpectedSensitiveCredentials(
        { PATH: "/bin", DASHBOARD_URL: "https://app.test", STRIPE_PUBLISHABLE_KEY: "pk_test" },
        new Set<string>(runtimeEnvAllowlists.dashboard),
      ),
    ).not.toThrow();
  });

  test("inherits only keys allowed for the selected runtime", () => {
    const previousCloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
    const previousCloudflareAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
    const previousStripeSecret = process.env.STRIPE_SECRET_KEY;
    const previousUnrelatedSecret = process.env.UNRELATED_SECRET;
    const environmentRoot = mkdtempSync(resolve(tmpdir(), "tamias-runtime-env-"));
    writeFileSync(
      resolve(environmentRoot, ".env.local-only"),
      "CLOUDFLARE_API_TOKEN=file-token\nCLOUDFLARE_ACCOUNT_ID=file-account\n",
    );
    process.env.CLOUDFLARE_API_TOKEN = "ci-cloudflare-token";
    process.env.CLOUDFLARE_ACCOUNT_ID = "ci-cloudflare-account";
    process.env.STRIPE_SECRET_KEY = "api-stripe-secret";
    process.env.UNRELATED_SECRET = "must-not-leak";

    try {
      const localEnvironment = loadRuntimeEnvironment(environmentRoot, ["localOnly"]);
      const apiEnvironment = loadRuntimeEnvironment(environmentRoot, ["api"]);

      expect(localEnvironment.CLOUDFLARE_API_TOKEN).toBe("ci-cloudflare-token");
      expect(localEnvironment.CLOUDFLARE_ACCOUNT_ID).toBe("ci-cloudflare-account");
      expect(localEnvironment).not.toHaveProperty("STRIPE_SECRET_KEY");
      expect(localEnvironment).not.toHaveProperty("UNRELATED_SECRET");
      expect(apiEnvironment.STRIPE_SECRET_KEY).toBe("api-stripe-secret");
      expect(apiEnvironment).not.toHaveProperty("CLOUDFLARE_API_TOKEN");
      expect(apiEnvironment).not.toHaveProperty("CLOUDFLARE_ACCOUNT_ID");
      expect(apiEnvironment).not.toHaveProperty("UNRELATED_SECRET");
    } finally {
      rmSync(environmentRoot, { force: true, recursive: true });

      if (previousCloudflareToken === undefined) {
        delete process.env.CLOUDFLARE_API_TOKEN;
      } else {
        process.env.CLOUDFLARE_API_TOKEN = previousCloudflareToken;
      }

      if (previousCloudflareAccount === undefined) {
        delete process.env.CLOUDFLARE_ACCOUNT_ID;
      } else {
        process.env.CLOUDFLARE_ACCOUNT_ID = previousCloudflareAccount;
      }

      if (previousStripeSecret === undefined) {
        delete process.env.STRIPE_SECRET_KEY;
      } else {
        process.env.STRIPE_SECRET_KEY = previousStripeSecret;
      }

      if (previousUnrelatedSecret === undefined) {
        delete process.env.UNRELATED_SECRET;
      } else {
        process.env.UNRELATED_SECRET = previousUnrelatedSecret;
      }
    }
  });

  test("keeps every committed runtime example inside its typed allowlist", () => {
    const repositoryRoot = resolve(import.meta.dir, "..");
    const exampleNames = {
      dashboard: "dashboard",
      api: "api",
      worker: "worker",
      documents: "documents",
      filing: "filing",
      localOnly: "local-only",
    } as const;

    for (const [runtime, fileName] of Object.entries(exampleNames)) {
      const contents = readFileSync(resolve(repositoryRoot, `.env.${fileName}.example`), "utf8");
      expect(() =>
        parseRuntimeEnvFile(
          contents,
          new Set<string>(runtimeEnvAllowlists[runtime as keyof typeof runtimeEnvAllowlists]),
        ),
      ).not.toThrow();
    }
  });
});
