import flags from "./country-flags";
import { currencies } from "./currencies";
import timezones from "./timezones.json";

/**
 * Parse the primary locale from an Accept-Language header value.
 * Returns the first language tag (e.g. "en-US" from "en-US,en;q=0.9").
 */
export function parseLocale(acceptLanguage: string | null): string {
  if (!acceptLanguage) return "en-US";
  const primary = acceptLanguage.split(",")[0]?.trim();
  if (!primary) return "en-US";
  return primary.split(";")[0]?.trim() || "en-US";
}

/**
 * Extract all location values from a resolved headers object (Cloudflare headers).
 * Use this when you already have the headers and want to avoid multiple async calls.
 */
export function getLocationHeaders(headersList: {
  get: (name: string) => string | null;
}): {
  country: string;
  timezone: string;
  locale: string;
} {
  return {
    country: headersList.get("cf-ipcountry") || "SE",
    timezone: headersList.get("cf-timezone") || "Europe/Berlin",
    locale: parseLocale(headersList.get("accept-language")),
  };
}

export function getCurrencyForCountry(
  countryCode: string | null | undefined,
): string | undefined {
  if (!countryCode) {
    return undefined;
  }

  return currencies[countryCode as keyof typeof currencies];
}

export function getTimezones() {
  return timezones;
}
