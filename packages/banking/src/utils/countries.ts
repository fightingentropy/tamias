export const PLAID_COUNTRIES = ["US", "CA"];

export const TELLER_COUNTRIES = ["US"];

const combinedCountries = [...new Set([...PLAID_COUNTRIES, ...TELLER_COUNTRIES])] as const;

export const ALL_COUNTRIES: readonly string[] = combinedCountries;
