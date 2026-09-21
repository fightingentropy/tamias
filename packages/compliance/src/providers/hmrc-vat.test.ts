import { afterEach, describe, expect, test } from "bun:test";
import type { HmrcFraudContext } from "../fraud-prevention";
import { HmrcRequestError, HmrcVatProvider } from "./hmrc-vat";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const provider = new HmrcVatProvider(
  {
    clientId: "synthetic-client",
    clientSecret: "synthetic-secret",
    redirectUri: "https://example.test/callback",
  },
  {
    provider: "hmrc-vat",
    accessToken: "synthetic-token",
    refreshToken: "synthetic-refresh",
    expiresAt: "2099-01-01T00:00:00Z",
    tokenType: "bearer",
    environment: "sandbox",
    scope: ["read:vat", "write:vat"],
  },
);
const fraudContext: HmrcFraudContext = {
  browser: {
    deviceId: "b5c2ef73-9cba-46af-8db7-15b45142fc32",
    userAgent: "SyntheticBrowser/1.0",
    timezone: "UTC+00:00",
    screens: [{ width: 1280, height: 800, colourDepth: 24, scalingFactor: 1 }],
    window: { width: 1024, height: 720 },
  },
  userId: "synthetic-user",
  publicIp: "198.51.100.10",
  publicIpTimestamp: "2026-09-21T00:00:00Z",
};
const getObligations = () =>
  provider.getObligations({
    vrn: "123456789",
    from: "2026-04-01",
    to: "2026-06-30",
    fraudContext,
  });
function respond(body: unknown, status: number, headers?: HeadersInit) {
  globalThis.fetch = Object.assign(async () => Response.json(body, { status, headers }), {
    preconnect: originalFetch.preconnect,
  });
}
async function failure(run = getObligations) {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(HmrcRequestError);
    return error as HmrcRequestError;
  }
  throw new Error("Expected HMRC failure");
}

describe("HMRC API error handling", () => {
  for (const [status, code, action] of [
    [400, "INVALID_REQUEST", "Review the tax details"],
    [401, "INVALID_CREDENTIALS", "Reconnect HMRC"],
    [403, "INVALID_SCOPE", "permissions"],
    [404, "MATCHING_RESOURCE_NOT_FOUND", "tax details and period"],
    [405, "METHOD_NOT_ALLOWED", "Contact Tamias support"],
    [406, "ACCEPT_HEADER_INVALID", "Contact Tamias support"],
    [429, "MESSAGE_THROTTLED_OUT", "Wait a moment"],
    [500, "INTERNAL_SERVER_ERROR", "check its status"],
    [501, "NOT_IMPLEMENTED", "check its status"],
    [503, "SCHEDULED_MAINTENANCE", "check its status"],
    [504, "GATEWAY_TIMEOUT", "check its status"],
  ] as const) {
    test(`handles HTTP ${status} with a safe, actionable message`, async () => {
      respond({ code, message: "SECRET_TAXPAYER_DATA" }, status);
      const error = await failure();
      expect(error.status).toBe(status);
      expect(error.code).toBe(code);
      expect(error.message).toContain(action);
      expect(JSON.stringify(error)).not.toContain("SECRET_TAXPAYER_DATA");
      expect(error.message).not.toContain("SECRET_TAXPAYER_DATA");
    });
  }
  test("retains recognised multiple error codes without leaking input or provider text", async () => {
    respond(
      {
        code: "INVALID_REQUEST",
        message: "SECRET_MAIN",
        errors: [
          { code: "INVALID_VRN", message: "SECRET_VRN", path: "/SECRET_PATH" },
          { code: "INVALID_DATE_FROM", message: "SECRET_DATE" },
          { code: "SECRET_UNKNOWN_CODE" },
          null,
          "SECRET_STRING",
        ],
      },
      400,
    );
    const error = await failure();
    expect(error.details).toEqual(["INVALID_VRN", "INVALID_DATE_FROM"]);
    expect(JSON.stringify(error)).not.toContain("SECRET_");
  });
  test("handles OAuth invalid_grant separately from tax API errors", async () => {
    respond({ error: "invalid_grant", error_description: "SECRET_REFRESH_TOKEN" }, 400);
    const error = await failure(async () => {
      await provider.refreshTokens("synthetic-refresh");
      return [];
    });
    expect(error.code).toBe("invalid_grant");
    expect(error.message).toContain("Reconnect HMRC");
    expect(JSON.stringify(error)).not.toContain("SECRET_");
  });
  test("reports valid retry delays without retrying automatically", async () => {
    for (const delay of ["120", new Date(Date.now() + 60000).toUTCString()]) {
      respond({ code: "MESSAGE_THROTTLED_OUT" }, 429, { "Retry-After": delay });
      const error = await failure();
      expect(error.retryAfterSeconds).toBeGreaterThan(0);
      expect(error.retryAfterSeconds).toBeLessThanOrEqual(120);
      expect(error.message).toContain("seconds");
    }
    for (const delay of ["-1", "999999", "SECRET_INVALID_DATE"]) {
      respond({}, 429, { "Retry-After": delay });
      const error = await failure();
      expect(error.retryAfterSeconds).toBeUndefined();
      expect(error.message).toContain("Wait a moment");
    }
  });
  test("malformed and oversized error bodies retain a safe HTTP-level error", async () => {
    for (const body of ["SECRET_NOT_JSON", "SECRET_".repeat(160000)]) {
      globalThis.fetch = Object.assign(async () => new Response(body, { status: 503 }), {
        preconnect: originalFetch.preconnect,
      });
      const error = await failure();
      expect(error.status).toBe(503);
      expect(error.code).toBe("UNKNOWN_ERROR");
      expect(error.message).not.toContain("SECRET_");
    }
  });
  test("an uncertain write is never retried after an HTTP or transport failure", async () => {
    for (const transportFailure of [false, true]) {
      let attempts = 0;
      globalThis.fetch = Object.assign(
        async () => {
          attempts++;
          if (transportFailure) throw new Error("SECRET_PROVIDER_URL timed out");
          return Response.json({ code: "GATEWAY_TIMEOUT" }, { status: 504 });
        },
        { preconnect: originalFetch.preconnect },
      );
      const error = await failure(async () => {
        await provider.submitReturn({
          vrn: "123456789",
          fraudContext,
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
        return [];
      });
      expect(attempts).toBe(1);
      expect(error.message).toContain("check its status before sending it again");
      expect(error.message).not.toContain("SECRET_");
    }
  });
  test("a truncated successful response does not expose a stream error", async () => {
    globalThis.fetch = Object.assign(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error("SECRET_STREAM_DATA"));
            },
          }),
        ),
      { preconnect: originalFetch.preconnect },
    );
    const error = await failure();
    expect(error.code).toBe("TRANSPORT_ERROR");
    expect(error.message).toContain("check its status before sending it again");
    expect(error.message).not.toContain("SECRET_");
  });
  test("missing or malformed obligations are never interpreted as an empty successful refresh", async () => {
    for (const body of [null, {}, { obligations: null }, { obligations: "SECRET_INVALID" }]) {
      respond(body, 200);
      const error = await failure();
      expect(error.code).toBe("INVALID_RESPONSE");
      expect(error.message).not.toContain("SECRET_");
    }
    respond({ obligations: [] }, 200);
    expect(await getObligations()).toEqual([]);
  });
});
