import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  assertNoUnexpectedSensitiveCredentials,
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
