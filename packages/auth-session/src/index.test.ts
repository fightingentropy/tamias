import { describe, expect, mock, test } from "bun:test";
import {
  type ApiKeyRecord,
  DASHBOARD_AUTH_HEADER,
  type OAuthAccessTokenRecord,
  type ResolveRequestAuthDependencies,
  TRUSTED_SESSION_HEADER,
  createTrustedSessionHeaderValue,
  expandScopes,
  resolveRequestAuth,
  type Session,
} from "./index";

const baseSession: Session = {
  teamId: "team_123",
  user: {
    id: "user_123" as Session["user"]["id"],
    convexId: "user_123" as Session["user"]["convexId"],
    email: "user@example.com",
    full_name: "User Example",
  },
};

function createDependencies(
  overrides: Partial<ResolveRequestAuthDependencies> = {},
): ResolveRequestAuthDependencies {
  return {
    internalApiKey: "internal-key",
    resolveUserSession: mock(async (_token?: string): Promise<Session | null> => null),
    getOAuthAccessTokenByToken: mock(
      async (_token: string): Promise<OAuthAccessTokenRecord | null> => null,
    ),
    getApiKeyByToken: mock(async (_token: string): Promise<ApiKeyRecord | null> => null),
    touchOAuthAccessToken: mock(async (_id: string): Promise<void> => {}),
    touchApiKey: mock(async (_id: string): Promise<void> => {}),
    ...overrides,
  };
}

describe("resolveRequestAuth", () => {
  test("accepts trusted dashboard requests", async () => {
    const dependencies = createDependencies();
    const trustedSession = await createTrustedSessionHeaderValue(
      "ignored-token",
      async () => baseSession,
    );

    const result = await resolveRequestAuth(
      {
        [DASHBOARD_AUTH_HEADER]: "internal-key",
        [TRUSTED_SESSION_HEADER]: trustedSession ?? "",
      },
      dependencies,
    );

    expect(result.session).toEqual(baseSession);
    expect(result.teamId).toBe(baseSession.teamId);
    expect(result.scopes).toEqual(expandScopes(["apis.all"]));
  });

  test("accepts first-party bearer sessions", async () => {
    const dependencies = createDependencies({
      resolveUserSession: mock(async (_token?: string): Promise<Session | null> => baseSession),
    });

    const result = await resolveRequestAuth(
      {
        authorization: "Bearer convex-jwt",
      },
      dependencies,
    );

    expect(dependencies.resolveUserSession).toHaveBeenCalledWith("convex-jwt");
    expect(result.session).toEqual(baseSession);
    expect(result.teamId).toBe("team_123");
  });

  test("accepts oauth access tokens", async () => {
    const dependencies = createDependencies({
      getOAuthAccessTokenByToken: mock(
        async (_token: string): Promise<OAuthAccessTokenRecord | null> => ({
          id: "token_123",
          applicationId: "app_123",
          teamId: "team_123",
          scopes: ["invoices.read"],
          user: {
            id: "user_123" as Session["user"]["id"],
            email: "user@example.com",
            fullName: "User Example",
          },
        }),
      ),
    });

    const result = await resolveRequestAuth(
      {
        authorization: "Bearer mid_access_token_123",
      },
      dependencies,
    );

    expect(dependencies.touchOAuthAccessToken).toHaveBeenCalledWith("token_123");
    expect(result.teamId).toBe("team_123");
    expect(result.scopes).toContain("invoices.read");
    expect(result.session?.user.email).toBe("user@example.com");
  });

  test("accepts api keys", async () => {
    const dependencies = createDependencies({
      getApiKeyByToken: mock(
        async (_token: string): Promise<ApiKeyRecord | null> => ({
          id: "key_123",
          teamId: "team_123",
          scopes: ["customers.read"],
          user: {
            id: "user_123" as Session["user"]["id"],
            email: "user@example.com",
            fullName: "User Example",
          },
        }),
      ),
    });

    const result = await resolveRequestAuth(
      {
        authorization: "Bearer mid_key_123",
      },
      dependencies,
    );

    expect(dependencies.touchApiKey).toHaveBeenCalledWith("key_123");
    expect(result.teamId).toBe("team_123");
    expect(result.scopes).toContain("customers.read");
  });

  test("returns anonymous auth when credentials are missing", async () => {
    const dependencies = createDependencies();

    const result = await resolveRequestAuth({}, dependencies);

    expect(result.session).toBeNull();
    expect(result.teamId).toBeUndefined();
    expect(result.scopes).toEqual([]);
  });

  test("marks internal requests separately from auth identity", async () => {
    const dependencies = createDependencies();

    const result = await resolveRequestAuth(
      {
        "x-internal-key": "internal-key",
      },
      dependencies,
    );

    expect(result.isInternalRequest).toBe(true);
    expect(result.session).toBeNull();
  });
});
