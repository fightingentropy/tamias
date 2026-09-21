import type { HmrcFraudContext } from "@tamias/compliance";
import { HmrcBrowserTelemetrySchema } from "@tamias/compliance/fraud-prevention-types";
import type { Session } from "@tamias/auth-session";

const transformedOrigins = new Set([
  "https://app.tamias.xyz",
  "https://api.tamias.xyz",
  "https://tamias.xyz",
]);

function usesVerifiedIngress(requestUrl?: string): boolean {
  if (!requestUrl) return false;
  try {
    const url = new URL(requestUrl);
    return !url.username && !url.password && transformedOrigins.has(url.origin);
  } catch {
    return false;
  }
}

function parseSourcePort(value: string | null): number | undefined {
  if (!value || !/^[0-9]{1,5}$/.test(value)) return undefined;
  const port = Number(value);
  return port > 0 && port <= 65535 ? port : undefined;
}

export function getHmrcFraudContext(
  headers: Headers,
  session: Session | null,
  requestUrl?: string,
): HmrcFraudContext | undefined {
  const value = headers.get("x-tamias-hmrc-device");
  if (!session || !value || value.length > 16000) return undefined;
  try {
    const browser = HmrcBrowserTelemetrySchema.parse(JSON.parse(decodeURIComponent(value)));
    // Cloudflare overwrites CF-Connecting-IP at ingress. Never accept a public
    // IP from procedure input or untrusted X-Forwarded-For.
    const publicIp = headers.get("cf-connecting-ip") ?? undefined;
    // Use the actual request URL, never Host or forwarded headers. Only these
    // origins have the verified zone transform; workers.dev/previews do not.
    const verifiedIngress = usesVerifiedIngress(requestUrl);
    // Trust fields independently. A verified source port does not establish
    // vendor-IP collection or permission to omit any other required header.
    const trustPort = verifiedIngress && process.env.HMRC_FRAUD_TRUST_CLIENT_PORT === "true";
    const trustVendorIp = verifiedIngress && process.env.HMRC_FRAUD_TRUST_VENDOR_IP === "true";
    return {
      browser,
      userId: session.user.id,
      userEmail: session.user.email,
      publicIp,
      publicIpTimestamp: new Date().toISOString(),
      publicPort: trustPort ? parseSourcePort(headers.get("x-tamias-hmrc-client-port")) : undefined,
      vendorPublicIp: trustVendorIp
        ? (headers.get("x-tamias-hmrc-vendor-ip") ?? undefined)
        : undefined,
    };
  } catch {
    return undefined;
  }
}
