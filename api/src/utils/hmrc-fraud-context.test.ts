import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { assertHmrcFraudContext } from "../../../packages/compliance/src/fraud-prevention";
import { getHmrcFraudContext } from "./hmrc-fraud-context";

const session = { user: { id: "synthetic-user", email: "synthetic@example.test" } };
const browser = {
  deviceId: "b5c2ef73-9cba-46af-8db7-15b45142fc32",
  userAgent: "SyntheticBrowser/1.0",
  timezone: "UTC+00:00",
  screens: [{ width: 1280, height: 800, scalingFactor: 1, colourDepth: 24 }],
  window: { width: 1024, height: 720 },
};
const envKeys = [
  "HMRC_FRAUD_TRUST_EDGE_HEADERS",
  "HMRC_FRAUD_TRUST_CLIENT_PORT",
  "HMRC_FRAUD_TRUST_VENDOR_IP",
  "HMRC_FRAUD_MISSING_HEADERS_APPROVED",
] as const;
const original = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
beforeEach(() => {
  for (const key of envKeys) delete process.env[key];
});
afterEach(() => {
  for (const key of envKeys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

function headers(port = "52341") {
  return new Headers({
    "x-tamias-hmrc-device": encodeURIComponent(JSON.stringify(browser)),
    "cf-connecting-ip": "198.51.100.10",
    "x-tamias-hmrc-client-port": port,
    "x-tamias-hmrc-vendor-ip": "203.0.113.10",
  });
}

describe("HMRC ingress trust", () => {
  test("trusts the verified port independently of vendor IP on all configured origins", () => {
    process.env.HMRC_FRAUD_TRUST_CLIENT_PORT = "true";
    for (const host of ["app.tamias.xyz", "api.tamias.xyz", "tamias.xyz"]) {
      const context = getHmrcFraudContext(headers(), session, `https://${host}/trpc/vat`);
      expect(context?.publicPort).toBe(52341);
      expect(context?.vendorPublicIp).toBeUndefined();
      expect(context?.userId).toBe(session.user.id);
    }
  });

  test("rejects custom edge headers on bypass routes even with forged forwarding headers", () => {
    process.env.HMRC_FRAUD_TRUST_CLIENT_PORT = "true";
    process.env.HMRC_FRAUD_TRUST_VENDOR_IP = "true";
    const forged = headers();
    forged.set("host", "api.tamias.xyz");
    forged.set("x-forwarded-host", "api.tamias.xyz");
    forged.set("x-forwarded-proto", "https");
    for (const url of [
      "https://tamias.synthetic.workers.dev/trpc/vat",
      "https://preview-tamias.synthetic.workers.dev/trpc/vat",
      "https://api.tamias.xyz.attacker.example/trpc/vat",
      "https://other.tamias.xyz/trpc/vat",
      "http://api.tamias.xyz/trpc/vat",
      "https://api.tamias.xyz:8443/trpc/vat",
      "https://api.tamias.xyz@attacker.example/trpc/vat",
      "not a URL",
      undefined,
    ]) {
      const context = getHmrcFraudContext(forged, session, url);
      expect(context?.publicPort).toBeUndefined();
      expect(context?.vendorPublicIp).toBeUndefined();
    }
  });

  test("does not revive the former combined trust switch", () => {
    process.env.HMRC_FRAUD_TRUST_EDGE_HEADERS = "true";
    const context = getHmrcFraudContext(headers(), session, "https://api.tamias.xyz/trpc/vat");
    expect(context?.publicPort).toBeUndefined();
    expect(context?.vendorPublicIp).toBeUndefined();
  });

  test("rejects malformed, duplicated and out-of-range port values", () => {
    process.env.HMRC_FRAUD_TRUST_CLIENT_PORT = "true";
    for (const port of ["", "0", "65536", "-1", "443.0", "1e3", "0x50", "42, 43", "Infinity"]) {
      expect(
        getHmrcFraudContext(headers(port), session, "https://api.tamias.xyz")?.publicPort,
      ).toBeUndefined();
    }
    for (const port of ["1", "65535"]) {
      expect(
        getHmrcFraudContext(headers(port), session, "https://api.tamias.xyz")?.publicPort,
      ).toBe(Number(port));
    }
  });

  test("requires an authenticated session and valid browser observations", () => {
    process.env.HMRC_FRAUD_TRUST_CLIENT_PORT = "true";
    expect(getHmrcFraudContext(headers(), null, "https://api.tamias.xyz")).toBeUndefined();
    const malformed = headers();
    malformed.set("x-tamias-hmrc-device", "%invalid");
    expect(getHmrcFraudContext(malformed, session, "https://api.tamias.xyz")).toBeUndefined();
  });

  test("still blocks production when the verified port is present but other required data is missing", () => {
    process.env.HMRC_FRAUD_TRUST_CLIENT_PORT = "true";
    const context = getHmrcFraudContext(headers(), session, "https://api.tamias.xyz");
    expect(context?.publicPort).toBe(52341);
    expect(() => assertHmrcFraudContext(context, "production")).toThrow(
      "HMRC live connection setup is incomplete",
    );
  });
});
