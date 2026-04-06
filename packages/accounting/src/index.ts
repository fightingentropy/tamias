import type { AccountingProvider } from "./provider";
import type { AccountingProviderConfig, AccountingProviderId, ProviderInitConfig } from "./types";
import { FORTNOX_SCOPES, QUICKBOOKS_SCOPES } from "./scopes";

export * from "./provider";
export { FORTNOX_SCOPES, QUICKBOOKS_SCOPES };
// Re-export types
export * from "./types";
export * from "./utils";

/**
 * OAuth environment variable mapping for each provider
 */
const PROVIDER_ENV_KEYS = {
  quickbooks: {
    clientId: "QUICKBOOKS_CLIENT_ID",
    clientSecret: "QUICKBOOKS_CLIENT_SECRET",
    redirectUri: "QUICKBOOKS_OAUTH_REDIRECT_URL",
  },
  fortnox: {
    clientId: "FORTNOX_CLIENT_ID",
    clientSecret: "FORTNOX_CLIENT_SECRET",
    redirectUri: "FORTNOX_OAUTH_REDIRECT_URL",
  },
} as const;

/**
 * Get OAuth credentials from environment variables for a provider
 *
 * @throws Error if any required credentials are missing
 */
export function getProviderOAuthCredentials(providerId: AccountingProviderId): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  if (providerId === "xero") {
    throw new Error("Xero integration has been removed. Please use QuickBooks or Fortnox.");
  }

  const envKeys = PROVIDER_ENV_KEYS[providerId];

  const clientId = process.env[envKeys.clientId];
  const clientSecret = process.env[envKeys.clientSecret];
  const redirectUri = process.env[envKeys.redirectUri];

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(`OAuth configuration missing for ${providerId}`);
  }

  return { clientId, clientSecret, redirectUri };
}

/**
 * Get an initialized accounting provider instance
 *
 * @param providerId - The provider identifier
 * @param config - Optional stored provider config (tokens, tenant info)
 * @returns An initialized AccountingProvider instance
 *
 * @example
 * ```typescript
 * const provider = await getAccountingProvider('quickbooks', storedConfig);
 * const accounts = await provider.getAccounts(orgId);
 * ```
 */
export async function getAccountingProvider(
  providerId: AccountingProviderId,
  config?: AccountingProviderConfig,
): Promise<AccountingProvider> {
  const credentials = getProviderOAuthCredentials(providerId);

  const initConfig: ProviderInitConfig = {
    ...credentials,
    config,
  };

  switch (providerId) {
    case "xero":
      throw new Error("Xero integration has been removed. Please use QuickBooks or Fortnox.");

    case "quickbooks": {
      const { QuickBooksProvider } = await import("./providers/quickbooks");
      return new QuickBooksProvider(initConfig);
    }

    case "fortnox": {
      const { FortnoxProvider } = await import("./providers/fortnox");
      return new FortnoxProvider(initConfig);
    }

    default: {
      // TypeScript exhaustive check
      const _exhaustive: never = providerId;
      throw new Error(`Unknown accounting provider: ${_exhaustive}`);
    }
  }
}

/**
 * Check if a provider is currently supported
 */
export function isProviderSupported(providerId: string): boolean {
  return providerId === "quickbooks" || providerId === "fortnox";
}

/**
 * Get list of all supported provider IDs
 */
export function getSupportedProviders(): AccountingProviderId[] {
  return ["quickbooks", "fortnox"];
}
