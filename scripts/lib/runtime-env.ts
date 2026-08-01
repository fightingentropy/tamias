import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const runtimeEnvAllowlists = {
  dashboard: [
    "NODE_ENV",
    "TAMIAS_ENVIRONMENT",
    "DASHBOARD_URL",
    "WEBSITE_URL",
    "API_URL",
    "STRIPE_PUBLISHABLE_KEY",
    "GOOGLE_API_KEY",
    "WHATSAPP_NUMBER",
    "OPENPANEL_CLIENT_ID",
    "OPENPANEL_SECRET_KEY",
    "LOGSNAG_PROJECT",
    "LOGSNAG_DISABLED",
    "TAMIAS_AUTH_SECRET",
    "TAMIAS_AUTH_ISSUER",
    "TAMIAS_DASHBOARD_SESSION_KEY",
    "INVOICE_JWT_SECRET",
    "FILE_KEY_SECRET",
  ],
  api: [
    "NODE_ENV",
    "TAMIAS_ENVIRONMENT",
    "ALLOWED_API_ORIGINS",
    "API_URL",
    "API_INTERNAL_URL",
    "DASHBOARD_URL",
    "WEBSITE_URL",
    "TAMIAS_AUTH_SECRET",
    "TAMIAS_AUTH_ISSUER",
    "TAMIAS_DASHBOARD_SESSION_KEY",
    "INVOICE_JWT_SECRET",
    "FILE_KEY_SECRET",
    "TAMIAS_ENCRYPTION_KEY",
    "TAMIAS_PAYMENT_ENVIRONMENT",
    "TAMIAS_LIVE_PAYMENTS_ENABLED",
    "TAMIAS_LIVE_PAYMENTS_CONFIRMATION",
    "OPENAI_API_KEY",
    "OPENAI_ASSISTANT_MODEL_PRIMARY",
    "OPENAI_ASSISTANT_MODEL_SMALL",
    "OPENAI_ASSISTANT_MODEL_MICRO",
    "KIMI_API_KEY",
    "KIMI_BASE_URL",
    "KIMI_MODEL_PRIMARY",
    "KIMI_MODEL_SMALL",
    "KIMI_MODEL_MICRO",
    "OPENROUTER_API_KEY",
    "OPENROUTER_BASE_URL",
    "OPENROUTER_ASSISTANT_MODEL_PRIMARY",
    "OPENROUTER_ASSISTANT_MODEL_SMALL",
    "OPENROUTER_ASSISTANT_MODEL_MICRO",
    "OPENROUTER_HTTP_REFERER",
    "OPENROUTER_APP_NAME",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "MISTRAL_API_KEY",
    "ELEVENLABS_API_KEY",
    "ELEVENLABS_VOICE_ID",
    "EXA_API_KEY",
    "PLAIN_API_KEY",
    "STRIPE_CONNECT_CLIENT_ID",
    "STRIPE_CONNECT_WEBHOOK_SECRET",
    "STRIPE_SECRET_KEY",
    "POLAR_ACCESS_TOKEN",
    "POLAR_ENVIRONMENT",
    "POLAR_WEBHOOK_SECRET",
    "TRUELAYER_CLIENT_ID",
    "TRUELAYER_CLIENT_SECRET",
    "TRUELAYER_ENVIRONMENT",
    "TRUELAYER_REDIRECT_URI",
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REDIRECT_URI",
    "OUTLOOK_CLIENT_ID",
    "OUTLOOK_CLIENT_SECRET",
    "OUTLOOK_REDIRECT_URI",
    "SLACK_CLIENT_ID",
    "SLACK_CLIENT_SECRET",
    "SLACK_OAUTH_REDIRECT_URL",
    "SLACK_SIGNING_SECRET",
    "SLACK_STATE_SECRET",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_APP_SECRET",
    "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_VERIFY_TOKEN",
    "INBOX_WEBHOOK_USERNAME",
    "INBOX_WEBHOOK_PASSWORD",
    "CLOUDFLARE_ZONE_ID",
    "CLOUDFLARE_CACHE_PURGE_TOKEN",
    "TAMIAS_SERVICE_DASHBOARD_KEY",
    "TAMIAS_SERVICE_DASHBOARD_KEY_ID",
    "TAMIAS_SERVICE_DASHBOARD_PREVIOUS_KEY",
    "TAMIAS_SERVICE_DASHBOARD_PREVIOUS_KEY_ID",
    "TAMIAS_SERVICE_WORKER_KEY",
    "TAMIAS_SERVICE_WORKER_KEY_ID",
    "TAMIAS_SERVICE_WORKER_PREVIOUS_KEY",
    "TAMIAS_SERVICE_WORKER_PREVIOUS_KEY_ID",
    "TAMIAS_SERVICE_DOCUMENTS_KEY",
    "TAMIAS_SERVICE_DOCUMENTS_KEY_ID",
    "TAMIAS_SERVICE_DOCUMENTS_PREVIOUS_KEY",
    "TAMIAS_SERVICE_DOCUMENTS_PREVIOUS_KEY_ID",
  ],
  worker: [
    "NODE_ENV",
    "TAMIAS_ENVIRONMENT",
    "API_URL",
    "API_INTERNAL_URL",
    "DASHBOARD_URL",
    "WEBSITE_URL",
    "TAMIAS_SERVICE_ID",
    "TAMIAS_SERVICE_KEY",
    "TAMIAS_SERVICE_KEY_ID",
    "TRANSACTION_ENRICHMENT_PROVIDER",
    "TRANSACTION_ENRICHMENT_BATCH_SIZE",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "GOOGLE_TRANSACTION_ENRICHMENT_MODEL",
    "OPENROUTER_API_KEY",
    "OPENROUTER_BASE_URL",
    "OPENROUTER_TRANSACTION_ENRICHMENT_MODEL",
    "OPENROUTER_HTTP_REFERER",
    "OPENROUTER_APP_NAME",
    "OPENAI_API_KEY",
    "EXA_API_KEY",
    "QUICKBOOKS_CLIENT_ID",
    "QUICKBOOKS_CLIENT_SECRET",
    "QUICKBOOKS_OAUTH_REDIRECT_URL",
    "FORTNOX_CLIENT_ID",
    "FORTNOX_CLIENT_SECRET",
    "FORTNOX_OAUTH_REDIRECT_URL",
    "XERO_CLIENT_ID",
    "XERO_CLIENT_SECRET",
    "XERO_OAUTH_REDIRECT_URL",
    "INSIGHTS_ENABLED_TEAM_IDS",
    "INSIGHTS_NOTIFICATIONS_ENABLED",
    "MATCHING_NOTIFICATIONS_ENABLED",
    "MATCH_AUTO_ENABLED",
    "TAMIAS_SYNC_INSTITUTIONS",
  ],
  documents: [
    "NODE_ENV",
    "TAMIAS_ENVIRONMENT",
    "API_URL",
    "DASHBOARD_URL",
    "WEBSITE_URL",
    "TAMIAS_SERVICE_ID",
    "TAMIAS_SERVICE_KEY",
    "TAMIAS_SERVICE_KEY_ID",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "OPENAI_API_KEY",
    "MISTRAL_API_KEY",
  ],
  filing: [
    "UK_COMPLIANCE_ENABLED",
    "TAMIAS_LIVE_FILING_ENABLED",
    "TAMIAS_LIVE_FILING_CONFIRMATION",
    "COMPANIES_HOUSE_API_KEY",
    "COMPANIES_HOUSE_CLIENT_ID",
    "COMPANIES_HOUSE_CLIENT_SECRET",
    "COMPANIES_HOUSE_OAUTH_REDIRECT_URL",
    "COMPANIES_HOUSE_ENVIRONMENT",
    "COMPANIES_HOUSE_XML_ENVIRONMENT",
    "COMPANIES_HOUSE_XML_PACKAGE_REFERENCE",
    "COMPANIES_HOUSE_XML_PRESENTER_ID",
    "COMPANIES_HOUSE_XML_PRESENTER_AUTHENTICATION_CODE",
    "HMRC_CT_ENVIRONMENT",
    "HMRC_CT_SENDER_ID",
    "HMRC_CT_SENDER_PASSWORD",
    "HMRC_CT_VENDOR_ID",
    "HMRC_CT_TEST_UTR",
    "HMRC_CT_PRODUCT_NAME",
    "HMRC_CT_PRODUCT_VERSION",
    "HMRC_VAT_CLIENT_ID",
    "HMRC_VAT_CLIENT_SECRET",
    "HMRC_VAT_ENVIRONMENT",
    "HMRC_VAT_OAUTH_REDIRECT_URL",
  ],
  localOnly: [
    "LOG_LEVEL",
    "LOG_PRETTY",
    "DEBUG_PERF",
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_ENDPOINT",
    "R2_BUCKET_NAME",
  ],
} as const;

export type RuntimeEnvName = keyof typeof runtimeEnvAllowlists;
export type RuntimeEnvKey<Name extends RuntimeEnvName> =
  (typeof runtimeEnvAllowlists)[Name][number];
export type TypedRuntimeEnvironment<Name extends RuntimeEnvName> = Partial<
  Record<RuntimeEnvKey<Name>, string>
>;

const safeInheritedNames = new Set([
  "CI",
  "HOME",
  "LANG",
  "LC_ALL",
  "PATH",
  "PWD",
  "SHELL",
  "TERM",
  "TMPDIR",
  "TZ",
  "USER",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
]);

const sensitiveName = /(?:^|_)(?:AUTH|CREDENTIAL|KEY|PASSWORD|PRIVATE|SECRET|TOKEN)(?:_|$)/i;

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function parseRuntimeEnvFile(contents: string, allowedKeys: ReadonlySet<string>) {
  const parsed: Record<string, string> = {};

  for (const [lineIndex, rawLine] of contents.split(/\r?\n/).entries()) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      throw new Error(`Invalid environment assignment on line ${lineIndex + 1}`);
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!allowedKeys.has(key)) {
      throw new Error(`Environment key ${key} is not allowed for this runtime`);
    }

    parsed[key] = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());
  }

  return parsed;
}

export function assertNoUnexpectedSensitiveCredentials(
  environment: Record<string, string | undefined>,
  allowedKeys: ReadonlySet<string>,
) {
  const unexpected = Object.keys(environment)
    .filter(
      (key) => sensitiveName.test(key) && !allowedKeys.has(key) && !safeInheritedNames.has(key),
    )
    .sort();

  if (unexpected.length > 0) {
    throw new Error(
      `Unexpected sensitive credentials are visible to this runtime: ${unexpected.join(", ")}`,
    );
  }
}

export function loadRuntimeEnvironment(
  repoRoot: string,
  runtimes: RuntimeEnvName[],
  options: { includeLocalOverrides?: boolean } = {},
) {
  const allowedKeys = new Set(runtimes.flatMap((runtime) => [...runtimeEnvAllowlists[runtime]]));
  const environment: Record<string, string> = {};

  for (const key of safeInheritedNames) {
    const value = process.env[key];
    if (value !== undefined) {
      environment[key] = value;
    }
  }

  for (const runtime of runtimes) {
    const candidates = [`.env.${runtime === "localOnly" ? "local-only" : runtime}`];
    if (options.includeLocalOverrides) {
      candidates.push(`${candidates[0]}.local`);
    }

    for (const relativePath of candidates) {
      const filePath = path.join(repoRoot, relativePath);
      if (!existsSync(filePath)) {
        continue;
      }

      Object.assign(environment, parseRuntimeEnvFile(readFileSync(filePath, "utf8"), allowedKeys));
    }
  }

  assertNoUnexpectedSensitiveCredentials(environment, allowedKeys);
  return environment;
}
