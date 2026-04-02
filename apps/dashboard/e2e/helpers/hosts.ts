const defaultAppBaseUrl = "http://app.tamias.test:3001";
const defaultWebsiteBaseUrl = "http://tamias.test:3001";

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

export function getAppBaseUrl() {
  return process.env.PLAYWRIGHT_BASE_URL ?? defaultAppBaseUrl;
}

export function getWebsiteBaseUrl() {
  return process.env.PLAYWRIGHT_WEBSITE_URL ?? defaultWebsiteBaseUrl;
}

export function resolveTestUrl(baseUrl: string, pathname: string) {
  return new URL(pathname, ensureTrailingSlash(baseUrl)).toString();
}
