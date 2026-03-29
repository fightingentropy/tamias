const DEFAULT_APP_URL = "https://app.tamias.xyz";
const DEFAULT_WEBSITE_URL = "https://tamias.xyz";
const DEFAULT_API_URL = "https://api.tamias.xyz";
const DEFAULT_CDN_URL = "https://cdn.tamias.xyz";
const DEFAULT_SUPPORT_EMAIL = "support@tamias.xyz";

function getTamiasEnvironment() {
  return (
    process.env.TAMIAS_ENVIRONMENT ||
    process.env.CLOUDFLARE_ENV ||
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
  // Allow explicit override via DASHBOARD_URL env var
  if (process.env.DASHBOARD_URL || process.env.TAMIAS_DASHBOARD_URL) {
    return process.env.DASHBOARD_URL || process.env.TAMIAS_DASHBOARD_URL!;
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
  if (process.env.WEBSITE_URL || process.env.TAMIAS_WEBSITE_URL) {
    return process.env.WEBSITE_URL || process.env.TAMIAS_WEBSITE_URL!;
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
  // Allow explicit override via API_URL env var
  if (process.env.API_URL || process.env.TAMIAS_API_URL) {
    return process.env.API_URL || process.env.TAMIAS_API_URL!;
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

export function getSupportEmail() {
  return process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL;
}

export function getSupportFromDisplay() {
  return process.env.RESEND_FROM_EMAIL || `Tamias <${getSupportEmail()}>`;
}

export function getSupportReplyToEmail() {
  return process.env.RESEND_REPLY_TO_EMAIL || getSupportEmail();
}
