import {
  buildHmrcFraudPreventionHeaders,
  getMissingHmrcFraudHeaders,
  type HmrcFraudContext,
} from "../../packages/compliance/src/fraud-prevention";

// Sandbox only. The complete fixture tests serialization, not production
// telemetry collection or HMRC approval. No taxpayer identifiers or filings.
const mode = process.argv.includes("--complete-fixture")
  ? "complete-synthetic-fixture"
  : "current-collection-capabilities";
const context: HmrcFraudContext = {
  browser: {
    deviceId: "b5c2ef73-9cba-46af-8db7-15b45142fc32",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    timezone: "UTC+01:00",
    screens: [{ width: 1280, height: 800, scalingFactor: 2, colourDepth: 24 }],
    window: { width: 1024, height: 720 },
  },
  userId: "synthetic-readiness-user",
  userEmail: "synthetic@example.test",
  publicIp: "198.51.100.10",
  publicIpTimestamp: new Date().toISOString(),
  ...(mode === "complete-synthetic-fixture"
    ? {
        publicPort: 54321,
        vendorPublicIp: "203.0.113.10",
        multiFactor: [
          {
            type: "TOTP" as const,
            timestamp: new Date().toISOString(),
            reference: "synthetic-factor",
          },
        ],
        licenseIds: { tamias: "ab".repeat(32) },
      }
    : {}),
};
const clientId = process.env.HMRC_VAT_CLIENT_ID,
  clientSecret = process.env.HMRC_VAT_CLIENT_SECRET;
if (!clientId || !clientSecret) throw new Error("Sandbox OAuth client credentials required");
const tokenResponse = await fetch("https://test-api.service.hmrc.gov.uk/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  }),
  redirect: "error",
  signal: AbortSignal.timeout(20000),
});
if (!tokenResponse.ok) throw new Error(`Sandbox token exchange failed (${tokenResponse.status})`);
const { access_token } = (await tokenResponse.json()) as { access_token: string };
const headers = buildHmrcFraudPreventionHeaders(context);
const response = await fetch(
  "https://test-api.service.hmrc.gov.uk/test/fraud-prevention-headers/validate",
  {
    headers: {
      ...headers,
      Authorization: `Bearer ${access_token}`,
      Accept: "application/vnd.hmrc.1.0+json",
    },
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  },
);
const result = (await response.json()) as {
  code?: string;
  message?: string;
  errors?: unknown[];
  warnings?: unknown[];
};
console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      mode,
      synthetic: true,
      httpStatus: response.status,
      missingHeaders: getMissingHmrcFraudHeaders(headers),
      ...result,
    },
    null,
    2,
  ),
);
if (!response.ok || result.code === "INVALID_HEADERS") process.exitCode = 1;
