import { env } from "../../env";
import { ProviderError } from "../../utils/error";
import { logger } from "../../utils/logger";
import { withRateLimitRetry } from "../../utils/retry";
import type {
  TrueLayerAccountApi,
  TrueLayerBalanceApi,
  TrueLayerCardApi,
  TrueLayerCardBalanceApi,
  TrueLayerEnvironment,
  TrueLayerExchangeResponse,
  TrueLayerProviderApi,
  TrueLayerResponseEnvelope,
  TrueLayerTokens,
  TrueLayerTransactionApi,
} from "./types";

/**
 * TrueLayer Data API scopes. `offline_access` is required for refresh tokens.
 * `info`/`accounts`/`balance`/`transactions` cover current/savings accounts.
 * `cards` covers credit cards. `direct_debits`/`standing_orders` unlock richer
 * transaction metadata on UK current accounts.
 */
const DEFAULT_SCOPES = [
  "info",
  "accounts",
  "balance",
  "cards",
  "transactions",
  "direct_debits",
  "standing_orders",
  "offline_access",
].join(" ");

function resolveEnvironment(): TrueLayerEnvironment {
  const tier = env.TRUELAYER_ENVIRONMENT.trim().toLowerCase();
  return tier === "production" ? "production" : "sandbox";
}

function authBase(environment: TrueLayerEnvironment) {
  return environment === "production"
    ? "https://auth.truelayer.com"
    : "https://auth.truelayer-sandbox.com";
}

function apiBase(environment: TrueLayerEnvironment) {
  return environment === "production"
    ? "https://api.truelayer.com"
    : "https://api.truelayer-sandbox.com";
}

function parseTokenBlob(accessToken: string): TrueLayerTokens {
  try {
    const parsed = JSON.parse(accessToken) as Partial<TrueLayerTokens>;
    if (parsed.accessToken && parsed.refreshToken && parsed.expiresAt) {
      return parsed as TrueLayerTokens;
    }
  } catch {
    // fall through — treat as raw access token without refresh metadata
  }

  return {
    accessToken,
    refreshToken: "",
    expiresAt: new Date(0).toISOString(),
  };
}

export function encodeTokenBlob(tokens: TrueLayerTokens): string {
  return JSON.stringify(tokens);
}

type TrueLayerApiError = {
  error: string;
  error_description?: string;
};

function parseError(payload: unknown): TrueLayerApiError | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.error === "string") {
    return {
      error: record.error,
      error_description:
        typeof record.error_description === "string" ? record.error_description : undefined,
    };
  }
  return null;
}

function toProviderError(payload: unknown, fallbackMessage: string): ProviderError {
  const parsed = parseError(payload);
  if (parsed) {
    return new ProviderError({
      code: parsed.error,
      message: parsed.error_description ?? fallbackMessage,
    });
  }
  return new ProviderError({ code: "unknown", message: fallbackMessage });
}

export class TrueLayerApi {
  #clientId: string;
  #clientSecret: string;
  #redirectUri: string;
  #environment: TrueLayerEnvironment;

  constructor() {
    this.#clientId = env.TRUELAYER_CLIENT_ID;
    this.#clientSecret = env.TRUELAYER_CLIENT_SECRET;
    this.#redirectUri = env.TRUELAYER_REDIRECT_URI;
    this.#environment = resolveEnvironment();
  }

  get environment() {
    return this.#environment;
  }

  buildAuthUrl({ state, providers }: { state: string; providers?: string }) {
    const url = new URL(`${authBase(this.#environment)}/`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.#clientId);
    url.searchParams.set("scope", DEFAULT_SCOPES);
    url.searchParams.set("redirect_uri", this.#redirectUri);
    url.searchParams.set("state", state);
    // Sandbox exposes only the credentials-sharing Mock bank (uk-cs-mock);
    // production uses real Open Banking + OAuth providers.
    const defaultProviders =
      this.#environment === "sandbox" ? "uk-cs-mock" : "uk-ob-all uk-oauth-all";
    url.searchParams.set("providers", providers ?? defaultProviders);
    if (this.#environment === "sandbox") {
      url.searchParams.set("enable_mock", "true");
    }
    return url.toString();
  }

  async exchangeCode(code: string): Promise<TrueLayerExchangeResponse> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.#clientId,
      client_secret: this.#clientSecret,
      redirect_uri: this.#redirectUri,
      code,
    });

    const response = await fetch(`${authBase(this.#environment)}/connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      logger.error("TrueLayer token exchange failed", { status: response.status, payload });
      throw toProviderError(payload, "TrueLayer token exchange failed");
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  async refreshTokens(refreshToken: string): Promise<TrueLayerTokens> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.#clientId,
      client_secret: this.#clientSecret,
      refresh_token: refreshToken,
    });

    const response = await fetch(`${authBase(this.#environment)}/connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      logger.error("TrueLayer token refresh failed", { status: response.status, payload });
      throw toProviderError(payload, "TrueLayer token refresh failed");
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    };
  }

  async #resolveAccessToken(rawAccessToken: string): Promise<string> {
    const tokens = parseTokenBlob(rawAccessToken);
    const expires = Date.parse(tokens.expiresAt);
    const needsRefresh = Number.isFinite(expires)
      ? expires - Date.now() < 60_000 && tokens.refreshToken
      : false;

    if (!needsRefresh) {
      return tokens.accessToken;
    }

    const refreshed = await this.refreshTokens(tokens.refreshToken);
    return refreshed.accessToken;
  }

  async #authedFetch<T>(path: string, accessToken: string): Promise<T> {
    const token = await this.#resolveAccessToken(accessToken);
    const response = await withRateLimitRetry(() =>
      fetch(`${apiBase(this.#environment)}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }),
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw toProviderError(payload, `TrueLayer request failed: ${path}`);
    }

    return (await response.json()) as T;
  }

  async getHealthCheck(): Promise<boolean> {
    try {
      const url = `${authBase(this.#environment)}/api/providers`;
      const response = await fetch(url, { method: "GET" });
      return response.status < 500;
    } catch {
      return false;
    }
  }

  async getAccounts(accessToken: string): Promise<TrueLayerAccountApi[]> {
    const envelope = await this.#authedFetch<TrueLayerResponseEnvelope<TrueLayerAccountApi>>(
      "/data/v1/accounts",
      accessToken,
    );
    return envelope.results ?? [];
  }

  async getCards(accessToken: string): Promise<TrueLayerCardApi[]> {
    const envelope = await this.#authedFetch<TrueLayerResponseEnvelope<TrueLayerCardApi>>(
      "/data/v1/cards",
      accessToken,
    );
    return envelope.results ?? [];
  }

  async getAccountBalance(accessToken: string, accountId: string): Promise<TrueLayerBalanceApi> {
    const envelope = await this.#authedFetch<TrueLayerResponseEnvelope<TrueLayerBalanceApi>>(
      `/data/v1/accounts/${accountId}/balance`,
      accessToken,
    );

    const balance = envelope.results?.[0];
    if (!balance) {
      throw new ProviderError({
        code: "unknown",
        message: `No balance returned for account ${accountId}`,
      });
    }
    return balance;
  }

  async getCardBalance(accessToken: string, accountId: string): Promise<TrueLayerCardBalanceApi> {
    const envelope = await this.#authedFetch<TrueLayerResponseEnvelope<TrueLayerCardBalanceApi>>(
      `/data/v1/cards/${accountId}/balance`,
      accessToken,
    );

    const balance = envelope.results?.[0];
    if (!balance) {
      throw new ProviderError({
        code: "unknown",
        message: `No card balance returned for account ${accountId}`,
      });
    }
    return balance;
  }

  async getAccountTransactions(
    accessToken: string,
    accountId: string,
    opts: { from?: string; to?: string } = {},
  ): Promise<TrueLayerTransactionApi[]> {
    const params = new URLSearchParams();
    if (opts.from) params.set("from", opts.from);
    if (opts.to) params.set("to", opts.to);
    const query = params.toString();
    const envelope = await this.#authedFetch<TrueLayerResponseEnvelope<TrueLayerTransactionApi>>(
      `/data/v1/accounts/${accountId}/transactions${query ? `?${query}` : ""}`,
      accessToken,
    );
    return envelope.results ?? [];
  }

  async getCardTransactions(
    accessToken: string,
    accountId: string,
    opts: { from?: string; to?: string } = {},
  ): Promise<TrueLayerTransactionApi[]> {
    const params = new URLSearchParams();
    if (opts.from) params.set("from", opts.from);
    if (opts.to) params.set("to", opts.to);
    const query = params.toString();
    const envelope = await this.#authedFetch<TrueLayerResponseEnvelope<TrueLayerTransactionApi>>(
      `/data/v1/cards/${accountId}/transactions${query ? `?${query}` : ""}`,
      accessToken,
    );
    return envelope.results ?? [];
  }

  async getProviders(): Promise<TrueLayerProviderApi[]> {
    // Public catalog endpoint — returns a raw array of providers, no auth required.
    const url = `${authBase(this.#environment)}/api/providers`;
    const response = await fetch(url);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw toProviderError(payload, "Failed to fetch TrueLayer providers");
    }

    const data = (await response.json()) as TrueLayerProviderApi[];
    return Array.isArray(data) ? data : [];
  }

  async revokeConnection(accessToken: string): Promise<void> {
    const token = await this.#resolveAccessToken(accessToken);
    const response = await fetch(`${apiBase(this.#environment)}/data/v1/me/logout`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok && response.status !== 404) {
      logger.warn("TrueLayer revoke failed", { status: response.status });
    }
  }

  async getConnectionStatus(accessToken: string): Promise<"connected" | "disconnected"> {
    try {
      await this.#authedFetch<unknown>("/data/v1/me", accessToken);
      return "connected";
    } catch (error) {
      if (error instanceof ProviderError && error.code === "disconnected") {
        return "disconnected";
      }
      logger.warn("TrueLayer connection status fell back to connected", {
        error: error instanceof Error ? error.message : String(error),
      });
      return "connected";
    }
  }
}
