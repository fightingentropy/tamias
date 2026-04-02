import { headers } from "@tamias/utils/request-runtime";
import flags from "./country-flags";
import { currencies } from "./currencies";
import { parseLocale } from "./index";

export async function getCountryCode() {
  const headersList = await headers();

  return headersList.get("cf-ipcountry") || "SE";
}

export async function getTimezone() {
  const headersList = await headers();

  return headersList.get("cf-timezone") || "Europe/Berlin";
}

export async function getLocale() {
  const headersList = await headers();

  return parseLocale(headersList.get("accept-language"));
}

export async function getCurrency() {
  const countryCode = await getCountryCode();

  return currencies[countryCode as keyof typeof currencies];
}

export async function getDateFormat() {
  const country = await getCountryCode();

  if (country === "US") {
    return "MM/dd/yyyy";
  }

  if (["CN", "JP", "KR", "TW"].includes(country)) {
    return "yyyy-MM-dd";
  }

  if (["AU", "NZ", "IN", "ZA", "BR", "AR"].includes(country)) {
    return "dd/MM/yyyy";
  }

  return "yyyy-MM-dd";
}

export async function getCountry() {
  const country = await getCountryCode();

  if (country && Object.hasOwn(flags, country)) {
    return flags[country as keyof typeof flags];
  }

  return undefined;
}
