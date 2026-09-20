import {
  assertHmrcFraudContext,
  buildHmrcFraudPreventionHeaders,
  type HmrcFraudContext,
} from "../fraud-prevention";
import {
  HMRC_VAT_SCOPES,
  type HmrcObligationResponse,
  type HmrcVatProviderConfig,
  HmrcVatProviderConfigSchema,
  type HmrcVatSubmission,
  type HmrcVatSubmissionResponse,
} from "../types";

type OAuthCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type HmrcTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

async function readHmrcJson<T>(response: Response): Promise<T> {
  const limit = 1024 * 1024;
  const reader = response.body?.getReader();
  if (!reader) throw new Error("HMRC returned an empty response");
  let bytes = 0;
  let text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw new Error("HMRC response exceeded the size limit");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error("HMRC returned an invalid response");
    }
  } finally {
    await reader.cancel();
  }
}

export class HmrcVatProvider {
  readonly id = "hmrc-vat" as const;
  readonly name = "HMRC VAT";

  constructor(
    private readonly credentials: OAuthCredentials,
    private readonly config?: HmrcVatProviderConfig,
  ) {}

  static fromEnvironment(config?: HmrcVatProviderConfig) {
    const clientId = process.env.HMRC_VAT_CLIENT_ID;
    const clientSecret = process.env.HMRC_VAT_CLIENT_SECRET;
    const redirectUri = process.env.HMRC_VAT_OAUTH_REDIRECT_URL;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("HMRC VAT OAuth configuration missing");
    }

    return new HmrcVatProvider({ clientId, clientSecret, redirectUri }, config);
  }

  get environment() {
    return (
      this.config?.environment ??
      (process.env.HMRC_VAT_ENVIRONMENT === "production" ? "production" : "sandbox")
    );
  }

  get baseUrl() {
    return this.environment === "production"
      ? "https://api.service.hmrc.gov.uk"
      : "https://test-api.service.hmrc.gov.uk";
  }

  buildConsentUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.credentials.clientId,
      redirect_uri: this.credentials.redirectUri,
      scope: HMRC_VAT_SCOPES.join(" "),
      state,
    });

    return `${this.baseUrl}/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string) {
    return this.exchangeToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.credentials.redirectUri,
    });
  }

  async refreshTokens(refreshToken: string) {
    return this.exchangeToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }

  isTokenExpired(expiresAt: Date, bufferSeconds = 60) {
    return expiresAt.getTime() - Date.now() <= bufferSeconds * 1000;
  }

  async getObligations(params: {
    vrn: string;
    from: string;
    to: string;
    accessToken?: string;
    fraudContext?: HmrcFraudContext;
  }): Promise<HmrcObligationResponse[]> {
    const query = new URLSearchParams({
      from: params.from,
      to: params.to,
      status: "O",
    });

    const response = await this.request<{
      obligations: HmrcObligationResponse[];
    }>(`/organisations/vat/${params.vrn}/obligations?${query.toString()}`, {
      accessToken: params.accessToken,
      fraudContext: params.fraudContext,
    });

    return response.obligations ?? [];
  }

  async submitReturn(params: {
    vrn: string;
    submission: HmrcVatSubmission;
    accessToken?: string;
    fraudContext?: HmrcFraudContext;
  }): Promise<HmrcVatSubmissionResponse> {
    return this.request<HmrcVatSubmissionResponse>(`/organisations/vat/${params.vrn}/returns`, {
      method: "POST",
      accessToken: params.accessToken,
      fraudContext: params.fraudContext,
      body: JSON.stringify(params.submission),
    });
  }

  async checkConnection(params: {
    vrn: string;
    accessToken?: string;
    fraudContext?: HmrcFraudContext;
  }) {
    const obligations = await this.getObligations({
      vrn: params.vrn,
      from: new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      to: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      accessToken: params.accessToken,
      fraudContext: params.fraudContext,
    });

    return {
      connected: true,
      obligations: obligations.length,
    };
  }

  static buildFraudPreventionHeaders = buildHmrcFraudPreventionHeaders;

  private async exchangeToken(payload: Record<string, string>): Promise<HmrcVatProviderConfig> {
    const body = new URLSearchParams({
      client_id: this.credentials.clientId,
      client_secret: this.credentials.clientSecret,
      ...payload,
    });

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        `HMRC token exchange failed (${response.status}). Reconnect HMRC and try again.`,
      );
    }

    const tokenData = await readHmrcJson<HmrcTokenResponse>(response);

    return HmrcVatProviderConfigSchema.parse({
      provider: "hmrc-vat",
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      scope: tokenData.scope?.split(" ").filter(Boolean) ?? [...HMRC_VAT_SCOPES],
      tokenType: tokenData.token_type,
      vrn: this.config?.vrn,
      environment: this.environment,
    });
  }

  private async request<T>(
    path: string,
    params?: {
      method?: "GET" | "POST";
      accessToken?: string;
      body?: string;
      fraudContext?: HmrcFraudContext;
    },
  ): Promise<T> {
    const accessToken = params?.accessToken ?? this.config?.accessToken;

    if (!accessToken) {
      throw new Error("HMRC VAT access token missing");
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: params?.method ?? "GET",
      headers: {
        Accept: "application/vnd.hmrc.1.0+json",
        Authorization: `Bearer ${accessToken}`,
        ...(params?.body ? { "Content-Type": "application/json" } : undefined),
        ...assertHmrcFraudContext(params?.fraudContext, this.environment),
      },
      body: params?.body,
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(
        `HMRC VAT request failed (${response.status}). Check the connection and return details.`,
      );
    }

    return readHmrcJson<T>(response);
  }
}
