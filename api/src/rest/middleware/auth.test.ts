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

  test("accepts requests pinned to the authenticated workspace", async () => {
    const app = new Hono<Context>();
    app.use("*", withAuth);
    app.get("/", (c) => c.text("ok"));
    const response = await app.request("/", {
      headers: { Authorization: "Bearer token-123", "X-Tamias-Team-Id": "team_123" },
    });
    expect(response.status).toBe(200);
  });

  test("rejects stale workspace reads and writes before route work", async () => {
    const app = new Hono<Context>();
    const route = mock(() => new Response("must not run"));
    app.use("*", withAuth);
    app.all("/", route);
    for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
      const response = await app.request("/", {
        method,
        headers: { Authorization: "Bearer token-123", "X-Tamias-Team-Id": "previous_team" },
      });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: "Conflict", code: "workspace_changed" });
    }
    expect(route).not.toHaveBeenCalled();
  });
});
