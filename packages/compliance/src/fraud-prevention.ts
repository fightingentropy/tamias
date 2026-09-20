import { isIP } from "node:net";
import type { HmrcBrowserTelemetry } from "./fraud-prevention-types";

export type HmrcFraudContext = {
  browser: HmrcBrowserTelemetry;
  userId: string;
  userEmail?: string;
  publicIp?: string;
  publicIpTimestamp: string;
  publicPort?: number;
  vendorPublicIp?: string;
  // Only supply factors verified by the authentication service, never browser input.
  multiFactor?: Array<{
    type: "TOTP" | "AUTH_CODE" | "OTHER";
    timestamp: string;
    reference: string;
  }>;
  licenseIds?: Record<string, string>;
};

const encode = (value: string | number) => encodeURIComponent(String(value));
const pairs = (values: Record<string, string | number>) =>
  Object.entries(values)
    .map(([key, value]) => `${encode(key)}=${encode(value)}`)
    .join("&");

export function isPublicIp(value?: string): value is string {
  if (!value || !isIP(value)) return false;
  if (isIP(value) === 6) {
    const normalized = value.toLowerCase();
    return !/^(::|::1|::ffff:|fc|fd|fe[89ab]|ff)/.test(normalized);
  }
  const [a, b] = value.split(".").map(Number);
  return (
    a !== 0 &&
    a !== 10 &&
    a !== 127 &&
    a! < 224 &&
    !(a === 169 && b === 254) &&
    !(a === 172 && b! >= 16 && b! <= 31) &&
    !(a === 192 && b === 168) &&
    !(a === 100 && b! >= 64 && b! <= 127) &&
    !(a === 198 && (b === 18 || b === 19))
  );
}

// HMRC WEB_APP_VIA_SERVER v3.3. Missing values remain missing: never fabricate
// device dimensions, IPs, source ports, MFA factors or software licence keys.
export function buildHmrcFraudPreventionHeaders(context: HmrcFraudContext): Record<string, string> {
  const { browser } = context;
  const headers: Record<string, string> = {
    "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
    "Gov-Client-Browser-JS-User-Agent": browser.userAgent,
    "Gov-Client-Device-ID": browser.deviceId,
    "Gov-Client-Screens": browser.screens
      .map((screen) =>
        pairs({
          width: screen.width,
          height: screen.height,
          "scaling-factor": screen.scalingFactor,
          "colour-depth": screen.colourDepth,
        }),
      )
      .join(","),
    "Gov-Client-Timezone": browser.timezone,
    "Gov-Client-User-IDs": pairs({
      tamias: context.userId,
      ...(context.userEmail ? { email: context.userEmail } : {}),
    }),
    "Gov-Client-Window-Size": pairs(browser.window),
    "Gov-Vendor-Product-Name": "Tamias",
    "Gov-Vendor-Version": pairs({ tamias: process.env.HMRC_FRAUD_VENDOR_VERSION || "0.1.0" }),
  };
  if (isPublicIp(context.publicIp)) {
    headers["Gov-Client-Public-IP"] = context.publicIp;
    headers["Gov-Client-Public-IP-Timestamp"] = context.publicIpTimestamp;
  }
  if (
    context.publicPort &&
    Number.isInteger(context.publicPort) &&
    context.publicPort > 0 &&
    context.publicPort <= 65535
  ) {
    headers["Gov-Client-Public-Port"] = String(context.publicPort);
  }
  if (isPublicIp(context.vendorPublicIp)) {
    headers["Gov-Vendor-Public-IP"] = context.vendorPublicIp;
    if (isPublicIp(context.publicIp)) {
      headers["Gov-Vendor-Forwarded"] = pairs({
        by: context.vendorPublicIp,
        for: context.publicIp,
      });
    }
  }
  if (context.multiFactor?.length)
    headers["Gov-Client-Multi-Factor"] = context.multiFactor
      .map((factor) =>
        pairs({
          type: factor.type,
          timestamp: factor.timestamp,
          "unique-reference": factor.reference,
        }),
      )
      .join(",");
  if (context.licenseIds && Object.keys(context.licenseIds).length) {
    headers["Gov-Vendor-License-IDs"] = pairs(context.licenseIds);
  }
  return headers;
}

export const HMRC_REQUIRED_WEB_HEADERS = [
  "Gov-Client-Connection-Method",
  "Gov-Client-Browser-JS-User-Agent",
  "Gov-Client-Device-ID",
  "Gov-Client-Multi-Factor",
  "Gov-Client-Public-IP",
  "Gov-Client-Public-IP-Timestamp",
  "Gov-Client-Public-Port",
  "Gov-Client-Screens",
  "Gov-Client-Timezone",
  "Gov-Client-User-IDs",
  "Gov-Client-Window-Size",
  "Gov-Vendor-Forwarded",
  "Gov-Vendor-License-IDs",
  "Gov-Vendor-Product-Name",
  "Gov-Vendor-Public-IP",
  "Gov-Vendor-Version",
] as const;

export function getMissingHmrcFraudHeaders(headers: Record<string, string>) {
  return HMRC_REQUIRED_WEB_HEADERS.filter((header) => !headers[header]);
}

export function assertHmrcFraudContext(context: HmrcFraudContext | undefined, environment: string) {
  if (!context)
    throw new Error(
      "Open Tamias in your browser to collect the device information required by HMRC.",
    );
  const headers = buildHmrcFraudPreventionHeaders(context);
  if (environment === "production") {
    // Configure only after discussing and agreeing the specific omissions with HMRC.
    const approved = new Set(
      (process.env.HMRC_FRAUD_MISSING_HEADERS_APPROVED ?? "").split(",").map((v) => v.trim()),
    );
    const missing = getMissingHmrcFraudHeaders(headers).filter((header) => !approved.has(header));
    if (missing.length)
      throw new Error(
        "HMRC live connection setup is incomplete. Contact Tamias support before using this connection.",
      );
  }
  return headers;
}
