const DEFAULT_APP_URL = "https://app.tamias.xyz";
const DEFAULT_WEBSITE_URL = "https://tamias.xyz";
const DEFAULT_API_URL = "https://api.tamias.xyz";
const DEFAULT_CDN_URL = "https://cdn.tamias.xyz";
const DEFAULT_SUPPORT_EMAIL = "support@tamias.xyz";
const DEFAULT_CONVEX_URL = "https://fleet-chameleon-251.eu-west-1.convex.cloud";
const DEFAULT_CONVEX_SITE_URL = "https://fleet-chameleon-251.eu-west-1.convex.site";

function getFirstDefined(...values: Array<string | undefined>) {
  for (const value of values) {
    if (value !== undefined && value !== "") {
      return value;
    }
  }

  return undefined;
}

function getTamiasEnvironment() {
  return (
    getFirstDefined(process.env.TAMIAS_ENVIRONMENT, process.env.CLOUDFLARE_ENV) ||
    (process.env.NODE_ENV === "production" ? "production" : "development")
  );
}

function getCloudflarePreviewUrl() {
  if (process.env.CF_PAGES_URL) {
    return `https://${process.env.CF_PAGES_URL}`;
  }

  if (process.env.CLOUDFLARE_DEPLOYMENT_URL) {
    return process.env.CLOUDFLARE_DEPLOYMENT_URL;
  }

  return null;
}

export function getAppUrl() {
  const explicitUrl = getFirstDefined(process.env.DASHBOARD_URL, process.env.TAMIAS_DASHBOARD_URL);

  if (explicitUrl) {
    return explicitUrl;
  }

  const environment = getTamiasEnvironment();

  if (environment === "production") {
    return DEFAULT_APP_URL;
  }

  const cloudflarePreviewUrl = getCloudflarePreviewUrl();
  if (cloudflarePreviewUrl) {
    return cloudflarePreviewUrl;
  }

  return "http://localhost:3001";
}

export function getWebsiteUrl() {
  const explicitUrl = getFirstDefined(process.env.WEBSITE_URL, process.env.TAMIAS_WEBSITE_URL);

  if (explicitUrl) {
    return explicitUrl;
  }

  if (getTamiasEnvironment() === "development") {
    return "http://localhost:3000";
  }

  const cloudflarePreviewUrl = getCloudflarePreviewUrl();
  if (cloudflarePreviewUrl) {
    return cloudflarePreviewUrl;
  }

  return DEFAULT_WEBSITE_URL;
}

export function getEmailUrl() {
  return getWebsiteUrl();
}

export function getCdnUrl() {
  return process.env.CDN_URL || DEFAULT_CDN_URL;
}

export function getApiUrl() {
  const explicitUrl = getFirstDefined(process.env.API_URL, process.env.TAMIAS_API_URL);

  if (explicitUrl) {
    return explicitUrl;
  }

  const environment = getTamiasEnvironment();

  if (environment === "production") {
    return DEFAULT_API_URL;
  }

  const cloudflarePreviewUrl = getCloudflarePreviewUrl();
  if (cloudflarePreviewUrl) {
    return cloudflarePreviewUrl;
  }

  return "http://localhost:3003";
}

export function getConvexUrl() {
  const explicitUrl = getFirstDefined(process.env.CONVEX_URL, process.env.TAMIAS_CONVEX_URL);

  if (explicitUrl) {
    return explicitUrl;
  }

  if (getTamiasEnvironment() === "production") {
    return DEFAULT_CONVEX_URL;
  }

  return "";
}

export function getConvexSiteUrl() {
  const explicitUrl = getFirstDefined(
    process.env.CONVEX_SITE_URL,
    process.env.TAMIAS_CONVEX_SITE_URL,
  );

  if (explicitUrl) {
    return explicitUrl;
  }

  if (getTamiasEnvironment() === "production") {
    return DEFAULT_CONVEX_SITE_URL;
  }

  return "";
}

export function getStripePublishableKey() {
  return getFirstDefined(process.env.STRIPE_PUBLISHABLE_KEY) || "";
}

export function getTellerApplicationId() {
  return getFirstDefined(process.env.TELLER_APPLICATION_ID) || "";
}

export function getTellerEnvironment() {
  return getFirstDefined(process.env.TELLER_ENVIRONMENT) || "";
}

export function getPlaidEnvironment() {
  return "sandbox";
}

export function getGoogleApiKey() {
  return getFirstDefined(process.env.GOOGLE_API_KEY) || "";
}

export function getWhatsAppNumber() {
  return getFirstDefined(process.env.WHATSAPP_NUMBER) || "";
}

export function getSupportEmail() {
  return process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL;
}

export function getSupportFromDisplay() {
  return process.env.RESEND_FROM_EMAIL || `Tamias <${getSupportEmail()}>`;
}

export function getSupportReplyToEmail() {
  return process.env.RESEND_REPLY_TO_EMAIL || getSupportEmail();
}
