import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { consumeRateLimit } from "../../rate-limit/shared";
import type { Context } from "../types";
import { createRateLimitMiddleware } from "./rate-limit";

function createRateLimitTestEnv() {
  const buckets = new Map<
    string,
    ReturnType<typeof consumeRateLimit>["bucket"]
  >();

  return {
    RATE_LIMIT_COORDINATOR: {
      getByName(name: string) {
        return {
          consume: async (payload: {
            key: string;
            limit: number;
            windowMs: number;
            nowMs?: number;
          }) => {
            const nextState = consumeRateLimit(buckets.get(name), payload);

            buckets.set(name, nextState.bucket);

            return nextState.outcome;
          },
        };
      },
    },
  } as unknown as Context["Bindings"];
}

function createApp() {
  const app = new Hono<Context>();

  app.use(
    "*",
    createRateLimitMiddleware({
      name: "test-rest-api",
      windowMs: 60_000,
      limit: 2,
      keyGenerator: (c) => c.req.header("x-test-key") || "unknown",
      message: "Rate limit exceeded",
    }),
  );

  app.get("/", (c) => c.json({ ok: true }));

  return app;
}

describe("REST rate limit middleware", () => {
  test("allows requests until the configured limit", async () => {
    const app = createApp();
    const env = createRateLimitTestEnv();

    const first = await app.request(
      "/",
      { headers: { "x-test-key": "team-1" } },
      env,
    );
    const second = await app.request(
      "/",
      { headers: { "x-test-key": "team-1" } },
      env,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(second.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  test("blocks requests after the configured limit", async () => {
    const app = createApp();
    const env = createRateLimitTestEnv();

    await app.request("/", { headers: { "x-test-key": "team-1" } }, env);
    await app.request("/", { headers: { "x-test-key": "team-1" } }, env);
    const blocked = await app.request(
      "/",
      { headers: { "x-test-key": "team-1" } },
      env,
    );

    expect(blocked.status).toBe(429);
    expect(await blocked.text()).toBe("Rate limit exceeded");
    expect(blocked.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(blocked.headers.get("Retry-After")).not.toBeNull();
  });

  test("tracks keys independently", async () => {
    const app = createApp();
    const env = createRateLimitTestEnv();

    await app.request("/", { headers: { "x-test-key": "team-1" } }, env);
    await app.request("/", { headers: { "x-test-key": "team-1" } }, env);
    const differentKey = await app.request(
      "/",
      { headers: { "x-test-key": "team-2" } },
      env,
    );

    expect(differentKey.status).toBe(200);
    expect(differentKey.headers.get("X-RateLimit-Remaining")).toBe("1");
  });
});
