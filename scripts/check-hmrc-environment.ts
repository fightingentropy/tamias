/** Read-only sandbox connectivity check. Never print or persist OAuth tokens. */
const present = (key: string) => Boolean(process.env[key]?.trim());
const restEnvironment = process.env.HMRC_VAT_ENVIRONMENT ?? "not configured";
const restConfigured = present("HMRC_VAT_CLIENT_ID") && present("HMRC_VAT_CLIENT_SECRET");
const report = {
  rest: {
    environment: restEnvironment,
    configured: restConfigured,
    callback: process.env.HMRC_VAT_OAUTH_REDIRECT_URL ?? null,
    authenticated: false,
    applicationEndpointVerified: false,
    error: null as string | null,
  },
  annualSelfAssessment: {
    environment: process.env.HMRC_SA_ENVIRONMENT ?? "test",
    vendorConfigured: present("HMRC_SA_VENDOR_ID"),
    testCredentialsConfigured:
      present("HMRC_SA_TEST_SENDER_ID") && present("HMRC_SA_TEST_PASSWORD"),
    existingCorporationTaxVendor: present("HMRC_CT_VENDOR_ID"),
  },
};

async function json(response: Response): Promise<Record<string, unknown>> {
  if (!response.body) throw new Error("empty_response");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let value = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 65_536) {
        await reader.cancel();
        throw new Error("oversized_response");
      }
      value += decoder.decode(part.value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  value += decoder.decode();
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("invalid_response");
  return parsed as Record<string, unknown>;
}

if (!restConfigured) {
  report.rest.error = "missing_credentials";
} else if (restEnvironment !== "sandbox") {
  report.rest.error = "sandbox_environment_required";
} else {
  try {
    const response = await fetch("https://test-api.service.hmrc.gov.uk/oauth/token", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.HMRC_VAT_CLIENT_ID!,
        client_secret: process.env.HMRC_VAT_CLIENT_SECRET!,
        scope: "hello",
      }),
    });
    const token = await json(response);
    if (response.ok && typeof token.access_token === "string" && token.access_token) {
      report.rest.authenticated = true;
      const hello = await fetch("https://test-api.service.hmrc.gov.uk/hello/application", {
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        headers: {
          Accept: "application/vnd.hmrc.1.0+json",
          Authorization: `Bearer ${token.access_token}`,
        },
      });
      const result = await json(hello);
      report.rest.applicationEndpointVerified = hello.ok && result.message === "Hello Application";
      if (!report.rest.applicationEndpointVerified)
        report.rest.error = `application_http_${hello.status}`;
    } else {
      // Only print known error codes; an upstream response might echo credentials.
      report.rest.error = [
        "invalid_client",
        "invalid_scope",
        "invalid_request",
        "server_error",
      ].includes(String(token.error))
        ? String(token.error)
        : `oauth_http_${response.status}`;
    }
  } catch {
    report.rest.error = "connection_check_failed";
  }
}
console.log(JSON.stringify(report, null, 2));
if (!report.rest.applicationEndpointVerified) process.exitCode = 1;
