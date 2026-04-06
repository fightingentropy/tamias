import { describe, expect, mock, test } from "bun:test";

const resolveRequestAuth = mock(async () => ({
  session: {
    teamId: "team_123",
    user: {
      id: "user_123",
      email: "user@example.com",
    },
  },
  teamId: "team_123",
  scopes: ["apis.all"],
  isInternalRequest: true,
}));

mock.module("@tamias/auth-session", () => ({
  resolveRequestAuth,
}));

mock.module("@tamias/app-services/auth", () => ({
  getRequestAuthDependencies: () => ({ mocked: true }),
}));

mock.module("@tamias/app-data/client", () => ({
  createDatabase: () => ({ mocked: true }),
  db: { mocked: true },
}));

const { createTRPCContextFromHeaders } = await import("./context");

describe("createTRPCContextFromHeaders", () => {
  test("hydrates session, trace, and geo context through the shared auth resolver", async () => {
    const headers = new Headers({
      "cf-ray": "cf-ray-1",
      "x-forwarded-for": "203.0.113.42",
      "x-request-id": "request-123",
      "x-user-country": "gb",
      "x-user-locale": "en-GB",
      "x-user-timezone": "Europe/London",
    });

    const context = await createTRPCContextFromHeaders(headers);

    expect(resolveRequestAuth).toHaveBeenCalled();
    expect(context.session?.user.email).toBe("user@example.com");
    expect(context.teamId).toBe("team_123");
    expect(context.isInternalRequest).toBe(true);
    expect(context.requestId).toBe("request-123");
    expect(context.cfRay).toBe("cf-ray-1");
    expect(context.geo.country).toBe("GB");
    expect(context.geo.locale).toBe("en-GB");
    expect(context.geo.timezone).toBe("Europe/London");
  });
});
