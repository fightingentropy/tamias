import { describe, expect, mock, test } from "bun:test";
import { Hono } from "hono";
import type { Context } from "../types";

const resolveRequestAuth = mock(async () => ({
  session: {
    teamId: "team_123",
    user: {
      id: "user_123",
      email: "user@example.com",
    },
  },
  teamId: "team_123",
  scopes: ["customers.read"],
}));

mock.module("@tamias/auth-session", () => ({
  resolveRequestAuth,
}));

mock.module("@tamias/app-services/auth", () => ({
  getRequestAuthDependencies: () => ({ mocked: true }),
}));

const { withAuth } = await import("./auth");

describe("withAuth", () => {
  test("injects shared auth data into the request context", async () => {
    const app = new Hono<Context>();

    app.use("*", withAuth);
    app.get("/", (c) =>
      c.json({
        scopes: c.get("scopes"),
        teamId: c.get("teamId"),
        userId: c.get("session")?.user?.id,
      }),
    );

    const response = await app.request("http://localhost/", {
      headers: {
        Authorization: "Bearer token-123",
      },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      scopes: string[];
      teamId: string;
      userId: string;
    };

    expect(body).toEqual({
      scopes: ["customers.read"],
      teamId: "team_123",
      userId: "user_123",
    });
  });

  test("rejects requests without a bearer token", async () => {
    const app = new Hono<Context>();

    app.use("*", withAuth);
    app.get("/", (c) => c.text("ok"));

    const response = await app.request("http://localhost/");

    expect(response.status).toBe(401);
  });
});
