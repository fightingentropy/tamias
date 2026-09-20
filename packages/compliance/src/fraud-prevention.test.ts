import { afterEach, describe, expect, test } from "bun:test";
import {
  assertHmrcFraudContext,
  buildHmrcFraudPreventionHeaders,
  getMissingHmrcFraudHeaders,
  type HmrcFraudContext,
} from "./fraud-prevention";
import { HmrcBrowserTelemetrySchema } from "./fraud-prevention-types";
import { HmrcVatProvider } from "./providers/hmrc-vat";

const context: HmrcFraudContext = {
  browser: {
    deviceId: "b5c2ef73-9cba-46af-8db7-15b45142fc32",
    userAgent: "TestBrowser/1.0",
    timezone: "UTC+01:00",
    screens: [{ width: 1280, height: 800, colourDepth: 24, scalingFactor: 2 }],
    window: { width: 1024, height: 720 },
  },
  userId: "user&123",
  userEmail: "test+filing@example.test",
  publicIp: "198.51.100.10",
  publicIpTimestamp: "2026-09-20T12:30:00.000Z",
};
const originalFetch = globalThis.fetch;
const originalApproval = process.env.HMRC_FRAUD_MISSING_HEADERS_APPROVED;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApproval === undefined) delete process.env.HMRC_FRAUD_MISSING_HEADERS_APPROVED;
  else process.env.HMRC_FRAUD_MISSING_HEADERS_APPROVED = originalApproval;
});

describe("HMRC fraud prevention", () => {
  test("serialises real browser observations using HMRC key-value encoding", () => {
    const h = buildHmrcFraudPreventionHeaders(context);
    expect(h["Gov-Client-Screens"]).toBe("width=1280&height=800&scaling-factor=2&colour-depth=24");
    expect(h["Gov-Client-Window-Size"]).toBe("width=1024&height=720");
    expect(h["Gov-Client-User-IDs"]).toBe("tamias=user%26123&email=test%2Bfiling%40example.test");
    expect(h["Gov-Client-Public-IP-Timestamp"]).toBe(context.publicIpTimestamp);
    expect(h).not.toHaveProperty("Gov-Client-MAC-Addresses");
    expect(h).not.toHaveProperty("Gov-Client-User-Agent");
    expect(h).not.toHaveProperty("Gov-Client-Local-IPs");
  });
  test("leaves unobserved network and authentication values missing", () => {
    const h = buildHmrcFraudPreventionHeaders(context);
    expect(getMissingHmrcFraudHeaders(h)).toEqual([
      "Gov-Client-Multi-Factor",
      "Gov-Client-Public-Port",
      "Gov-Vendor-Forwarded",
      "Gov-Vendor-License-IDs",
      "Gov-Vendor-Public-IP",
    ]);
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "::1",
      "192.168.1.1",
      "100.64.0.1",
      "198.51.100.1, 198.51.100.2",
    ])
      expect(buildHmrcFraudPreventionHeaders({ ...context, publicIp: ip })).not.toHaveProperty(
        "Gov-Client-Public-IP",
      );
    expect(buildHmrcFraudPreventionHeaders({ ...context, publicPort: 65536 })).not.toHaveProperty(
      "Gov-Client-Public-Port",
    );
    // An observed source port is distinct from assuming the server's HTTPS port.
    expect(
      buildHmrcFraudPreventionHeaders({ ...context, publicPort: 443 })["Gov-Client-Public-Port"],
    ).toBe("443");
  });
  test("rejects forged extra telemetry and header injection", () => {
    expect(
      HmrcBrowserTelemetrySchema.safeParse({ ...context.browser, publicIp: "8.8.8.8" }).success,
    ).toBe(false);
    expect(
      HmrcBrowserTelemetrySchema.safeParse({
        ...context.browser,
        userAgent: "browser\r\nAuthorization: stolen",
      }).success,
    ).toBe(false);
    expect(HmrcBrowserTelemetrySchema.safeParse({ ...context.browser, screens: [] }).success).toBe(
      false,
    );
  });
  test("blocks incomplete production requests unless exact omissions were agreed with HMRC", () => {
    delete process.env.HMRC_FRAUD_MISSING_HEADERS_APPROVED;
    expect(() => assertHmrcFraudContext(context, "production")).toThrow("incomplete");
    expect(() => assertHmrcFraudContext(undefined, "sandbox")).toThrow("browser");
    process.env.HMRC_FRAUD_MISSING_HEADERS_APPROVED = getMissingHmrcFraudHeaders(
      buildHmrcFraudPreventionHeaders(context),
    ).join(",");
    expect(assertHmrcFraudContext(context, "production")).toHaveProperty("Gov-Client-Device-ID");
  });
  test("sends fraud headers on obligation reads and return writes", async () => {
    const requests: RequestInit[] = [];
    globalThis.fetch = Object.assign(
      async (_url: RequestInfo | URL, init?: RequestInit) => {
        requests.push(init!);
        return Response.json({ obligations: [], processingDate: "2026-09-20" });
      },
      { preconnect: originalFetch.preconnect },
    );
    const p = new HmrcVatProvider({
      clientId: "synthetic",
      clientSecret: "synthetic",
      redirectUri: "https://example.test/callback",
    });
    await p.getObligations({
      vrn: "123456789",
      from: "2026-04-01",
      to: "2026-06-30",
      accessToken: "fake",
      fraudContext: context,
    });
    await p.submitReturn({
      vrn: "123456789",
      accessToken: "fake",
      fraudContext: context,
      submission: {
        periodKey: "A001",
        vatDueSales: 1,
        vatDueAcquisitions: 0,
        totalVatDue: 1,
        vatReclaimedCurrPeriod: 0,
        netVatDue: 1,
        totalValueSalesExVAT: 5,
        totalValuePurchasesExVAT: 0,
        totalValueGoodsSuppliedExVAT: 0,
        totalAcquisitionsExVAT: 0,
        finalised: true,
      },
    });
    expect(requests).toHaveLength(2);
    for (const req of requests) {
      expect(new Headers(req.headers).get("Gov-Client-Device-ID")).toBe(context.browser.deviceId);
      expect(req.redirect).toBe("error");
    }
  });
  test("never forwards upstream response bodies into token errors", async () => {
    globalThis.fetch = Object.assign(
      async () => new Response("SECRET_PROVIDER_TOKEN", { status: 400 }),
      { preconnect: originalFetch.preconnect },
    );
    const p = new HmrcVatProvider({
      clientId: "synthetic",
      clientSecret: "synthetic",
      redirectUri: "https://example.test/callback",
    });
    try {
      await p.exchangeCodeForTokens("synthetic");
      throw new Error("Expected failure");
    } catch (error) {
      expect(String(error)).toContain("400");
      expect(String(error)).not.toContain("SECRET_PROVIDER_TOKEN");
    }
  });
  test("bounds and sanitises token response parsing", async () => {
    const p = new HmrcVatProvider({
      clientId: "synthetic",
      clientSecret: "synthetic",
      redirectUri: "https://example.test/callback",
    });
    for (const [body, error] of [
      ["SECRET_NOT_JSON", "HMRC returned an invalid response"],
      ["x".repeat(1024 * 1024 + 1), "HMRC response exceeded the size limit"],
    ]) {
      globalThis.fetch = Object.assign(async () => new Response(body), {
        preconnect: originalFetch.preconnect,
      });
      await expect(p.exchangeCodeForTokens("synthetic")).rejects.toThrow(error);
    }
  });
});
