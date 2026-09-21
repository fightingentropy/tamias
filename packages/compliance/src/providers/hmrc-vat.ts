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

const knownErrorCodes = new Set([
  "BAD_REQUEST",
  "INVALID_REQUEST",
  "MISSING_FIELD",
  "INVALID_DATE",
  "INVALID_VRN",
  "INVALID_PERIODKEY",
  "INVALID_MONETARY_AMOUNT",
  "INVALID_NUMERIC_VALUE",
  "INVALID_DATE_FROM",
  "INVALID_DATE_TO",
  "DATE_RANGE_TOO_LARGE",
  "INVALID_FINALISED",
  "DUPLICATE_SUBMISSION",
  "RULE_INCORRECT_GOV_TEST_SCENARIO",
  "NOT_FOUND",
  "NO_OBLIGATIONS_FOUND",
  "VRN_INVALID",
  "MISSING_CREDENTIALS",
  "INVALID_CREDENTIALS",
  "UNAUTHORIZED",
  "INCORRECT_ACCESS_TOKEN_TYPE",
  "HTTPS_REQUIRED",
  "RESOURCE_FORBIDDEN",
  "INVALID_SCOPE",
  "FORBIDDEN",
  "MATCHING_RESOURCE_NOT_FOUND",
  "METHOD_NOT_ALLOWED",
  "ACCEPT_HEADER_INVALID",
  "MESSAGE_THROTTLED_OUT",
  "INTERNAL_SERVER_ERROR",
  "NOT_IMPLEMENTED",
  "SERVER_ERROR",
  "SCHEDULED_MAINTENANCE",
  "GATEWAY_TIMEOUT",
  "invalid_request",
  "invalid_client",
  "invalid_grant",
  "unauthorized_client",
  "unsupported_grant_type",
  "invalid_scope",
  "access_denied",
  "server_error",
  "temporarily_unavailable",
]);

export class HmrcRequestError extends Error {
  readonly name = "HmrcRequestError";
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details: string[] = [],
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

async function fetchHmrc(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    // A lost response does not prove that HMRC rejected a submission. Do not
    // repeat a write automatically or expose transport errors containing URLs.
    throw new HmrcRequestError(
      "HMRC could not be reached or the request timed out. Try again later. If you submitted a return, check its status before sending it again.",
      0,
      "TRANSPORT_ERROR",
    );
  }
}

function knownCode(value: unknown): string | undefined {
  return typeof value === "string" && knownErrorCodes.has(value) ? value : undefined;
}

async function responseError(response: Response, tokenExchange = false) {
  const payload = await readHmrcJson<unknown>(response).catch(() => null);
  const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const code = knownCode(body.code ?? body.error) ?? "UNKNOWN_ERROR";
  const details = Array.isArray(body.errors)
    ? body.errors.slice(0, 20).flatMap((item) => {
        const detail = item && typeof item === "object" ? knownCode(item.code) : undefined;
        return detail ? [detail] : [];
      })
    : [];
  const retryAfter = response.headers.get("retry-after");
  const delay =
    retryAfter && /^[0-9]{1,6}$/.test(retryAfter)
      ? Number(retryAfter)
      : retryAfter && retryAfter.length <= 64
        ? Math.ceil((Date.parse(retryAfter) - Date.now()) / 1000)
        : NaN;
  const retryAfterSeconds =
    Number.isFinite(delay) && delay >= 0 && delay <= 86400 ? delay : undefined;
  let message: string;
  if (response.status === 429) {
    message =
      retryAfterSeconds === undefined
        ? "HMRC is limiting requests. Wait a moment before trying again."
        : `HMRC is limiting requests. Wait ${retryAfterSeconds} seconds before trying again.`;
  } else if (response.status >= 500) {
    message =
      "HMRC is temporarily unavailable. Try again later. If you submitted a return, check its status before sending it again.";
  } else if (response.status === 401 || tokenExchange) {
    message = "Reconnect HMRC to renew your authorisation.";
  } else if (response.status === 403) {
    message =
      "HMRC has not authorised access to these tax records. Check the connection and permissions.";
  } else if (response.status === 404) {
    message = "HMRC could not find the requested record. Check the tax details and period.";
  } else if (response.status === 405 || response.status === 406) {
    message = "HMRC rejected the application request format. Contact Tamias support.";
  } else {
    message =
      "HMRC rejected the request. Review the tax details and return values before trying again.";
  }
  // Never surface provider message/error_description fields: they can contain
  // taxpayer data or credentials. Retain only recognised machine-readable codes.
  return new HmrcRequestError(
    `${message} (HTTP ${response.status})`,
    response.status,
    code,
    details,
    retryAfterSeconds,
  );
}

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

    const response = await fetchHmrc(`${this.baseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw await responseError(response, true);
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

    const response = await fetchHmrc(`${this.baseUrl}${path}`, {
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
      throw await responseError(response);
    }

    return readHmrcJson<T>(response);
  }
}
