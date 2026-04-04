import { describe, expect, it } from "bun:test";
import { buildSiteLoginUrl } from "./login-url";

describe("buildSiteLoginUrl", () => {
  it("uses the canonical app URL when hosts are split", () => {
    expect(
      buildSiteLoginUrl({
        appUrl: "https://app.tamias.xyz",
        websiteUrl: "https://tamias.xyz",
      }),
    ).toBe("https://app.tamias.xyz/login");
  });

  it("keeps the login path relative when the app and site share an origin", () => {
    expect(
      buildSiteLoginUrl({
        appUrl: "http://localhost:3001",
        websiteUrl: "http://localhost:3001",
      }),
    ).toBe("/login");
  });

  it("uses the configured non-local dashboard origin", () => {
    expect(
      buildSiteLoginUrl({
        appUrl: "https://staging.tamias.xyz",
        websiteUrl: "https://marketing-staging.tamias.xyz",
      }),
    ).toBe("https://staging.tamias.xyz/login");
  });
});
