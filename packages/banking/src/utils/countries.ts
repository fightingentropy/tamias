/** Regions Plaid Link requests in `country_codes` (sandbox includes UK test banks). */
export const PLAID_COUNTRIES = ["GB", "US", "CA"];

export const TELLER_COUNTRIES = ["US"];

const combinedCountries = [...new Set([...PLAID_COUNTRIES, ...TELLER_COUNTRIES])] as const;

export const ALL_COUNTRIES: readonly string[] = combinedCountries;
