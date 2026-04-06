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
    });

    return response.obligations ?? [];
  }

  async submitReturn(params: {
    vrn: string;
    submission: HmrcVatSubmission;
    accessToken?: string;
    fraudHeaders?: Record<string, string>;
  }): Promise<HmrcVatSubmissionResponse> {
    return this.request<HmrcVatSubmissionResponse>(`/organisations/vat/${params.vrn}/returns`, {
      method: "POST",
      accessToken: params.accessToken,
      fraudHeaders: params.fraudHeaders,
      body: JSON.stringify(params.submission),
    });
  }

  async checkConnection(params: { vrn: string; accessToken?: string }) {
    const obligations = await this.getObligations({
      vrn: params.vrn,
      from: new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      to: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      accessToken: params.accessToken,
    });

    return {
      connected: true,
      obligations: obligations.length,
    };
  }

  static buildFraudPreventionHeaders(params: {
    deviceId: string;
    userId: string;
    userAgent?: string;
    publicIp?: string;
  }): Record<string, string> {
    return {
      "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
      "Gov-Client-Device-ID": params.deviceId,
      "Gov-Client-Local-IPs": "127.0.0.1",
      "Gov-Client-Local-IPs-Timestamp": new Date().toISOString(),
      "Gov-Client-MAC-Addresses": "00:00:5e:00:53:af",
      "Gov-Client-Multi-Factor": "",
      "Gov-Client-Screens":
        process.env.HMRC_FRAUD_CLIENT_SCREENS ??
        "width=1440;height=900;scaling-factor=2;colour-depth=24",
      "Gov-Client-Timezone": process.env.HMRC_FRAUD_CLIENT_TIMEZONE ?? "UTC+00:00",
      "Gov-Client-User-Agent":
        params.userAgent ?? process.env.HMRC_FRAUD_USER_AGENT ?? "Tamias/1.0",
      "Gov-Client-User-Ids": `tamias=${encodeURIComponent(params.userId)}`,
      "Gov-Client-Public-IP": params.publicIp ?? process.env.HMRC_FRAUD_PUBLIC_IP ?? "127.0.0.1",
      "Gov-Client-Public-Port": process.env.HMRC_FRAUD_PUBLIC_PORT ?? "443",
      "Gov-Vendor-License-Ids": process.env.HMRC_FRAUD_VENDOR_LICENSE_IDS ?? "tamias=uk-compliance",
      "Gov-Vendor-Product-Name": process.env.HMRC_FRAUD_VENDOR_PRODUCT_NAME ?? "Tamias",
      "Gov-Vendor-Version": process.env.HMRC_FRAUD_VENDOR_VERSION ?? "tamias=0.1.0",
    };
  }

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
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Tamias token exchange failed: ${text}`);
    }

    const tokenData = (await response.json()) as HmrcTokenResponse;

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
      fraudHeaders?: Record<string, string>;
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
        ...(params?.fraudHeaders ?? {}),
      },
      body: params?.body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HMRC VAT request failed (${response.status}): ${text}`);
    }

    return (await response.json()) as T;
  }
}
