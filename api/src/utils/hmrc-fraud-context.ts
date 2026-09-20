import type { HmrcFraudContext } from "@tamias/compliance";
import { HmrcBrowserTelemetrySchema } from "@tamias/compliance/fraud-prevention-types";
import type { Session } from "@tamias/auth-session";

export function getHmrcFraudContext(
  headers: Headers,
  session: Session | null,
): HmrcFraudContext | undefined {
  const value = headers.get("x-tamias-hmrc-device");
  if (!session || !value || value.length > 16000) return undefined;
  try {
    const browser = HmrcBrowserTelemetrySchema.parse(JSON.parse(decodeURIComponent(value)));
    // Cloudflare overwrites CF-Connecting-IP at ingress. Never accept a public
    // IP from procedure input or untrusted X-Forwarded-For.
    const publicIp = headers.get("cf-connecting-ip") ?? undefined;
    // These must be overwritten by a zone request-header transform on EVERY
    // ingress route before enabling this setting. See docs/hmrc-readiness.md.
    const trustedEdge = process.env.HMRC_FRAUD_TRUST_EDGE_HEADERS === "true";
    return {
      browser,
      userId: session.user.id,
      userEmail: session.user.email,
      publicIp,
      publicIpTimestamp: new Date().toISOString(),
      publicPort: trustedEdge
        ? Number(headers.get("x-tamias-hmrc-client-port")) || undefined
        : undefined,
      vendorPublicIp: trustedEdge
        ? (headers.get("x-tamias-hmrc-vendor-ip") ?? undefined)
        : undefined,
    };
  } catch {
    return undefined;
  }
}
