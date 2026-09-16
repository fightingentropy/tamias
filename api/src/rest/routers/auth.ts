import { OpenAPIHono } from "@hono/zod-openapi";
import {
  completePasswordReset,
  handleDashboardAuthAction,
  InvalidPasswordResetError,
  requestPasswordReset,
} from "@tamias/app-services/first-party-auth";
import { sendEmail } from "@tamias/email/send";
import { getAppUrl, getSupportFromDisplay } from "@tamias/utils/envs";
import { HTTPException } from "hono/http-exception";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { publicMiddleware } from "../middleware";
import { createRateLimitMiddleware } from "../middleware/rate-limit";
import type { Context } from "../types";

const app = new OpenAPIHono<Context>();

app.use("*", ...publicMiddleware);
app.use(
  "*",
  createRateLimitMiddleware({
    name: "dashboard-auth",
    windowMs: 10 * 60 * 1000,
    limit: 50,
    keyGenerator: (c) => c.get("clientIp") || "unknown",
    statusCode: 429,
    message: "Rate limit exceeded",
  }),
);

app.use("/password-reset/*", bodyLimit({ maxSize: 4096 }));
app.use(
  "/password-reset/*",
  createRateLimitMiddleware({
    name: "password-reset",
    windowMs: 15 * 60 * 1000,
    limit: 10,
    keyGenerator: (c) => c.get("clientIp") || "unknown",
    statusCode: 429,
    message: "Too many attempts. Please try again in 15 minutes.",
  }),
);

app.post("/password-reset/request", async (c) => {
  const body = z
    .object({ email: z.string().trim().email().max(254) })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Enter a valid email address." }, 400);

  // Lookup and delivery run after the same response for every valid address.
  c.executionCtx.waitUntil(
    requestPasswordReset(
      body.data.email,
      async (email, token) => {
        const link = new URL("/reset-password", getAppUrl());
        link.hash = new URLSearchParams({ token }).toString();
        await sendEmail({
          from: getSupportFromDisplay(),
          to: email,
          subject: "Reset your Tamias password",
          text: `Use this link to choose a new Tamias password:\n\n${link}\n\nThis link expires in 30 minutes and can be used once. If you did not request it, you can ignore this email. Your password has not changed.`,
        });
      },
      c.get("db"),
    ).catch(() => {
      console.error("[auth] Password reset email delivery failed");
    }),
  );
  c.header("Cache-Control", "no-store");
  return c.json({
    message: "If an account exists for that email, a reset link will arrive shortly.",
  });
});

app.post("/password-reset/complete", async (c) => {
  const body = z
    .object({ token: z.string().max(128), password: z.string().min(8).max(128) })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success)
    return c.json({ error: "Enter a password between 8 and 128 characters." }, 400);

  try {
    const { email } = await completePasswordReset(body.data.token, body.data.password, c.get("db"));
    c.executionCtx.waitUntil(
      sendEmail({
        from: getSupportFromDisplay(),
        to: email,
        subject: "Your Tamias password was changed",
        text: "Your Tamias password was changed and existing sessions were signed out. If you did not make this change, use Forgot password on the Tamias sign-in page to secure your account.",
      }).catch(() => {
        console.error("[auth] Password change notification delivery failed");
      }),
    );
    c.header("Cache-Control", "no-store");
    return c.json({ message: "Password updated. Sign in with your new password." });
  } catch (error) {
    if (error instanceof InvalidPasswordResetError) {
      return c.json({ error: error.message }, 400);
    }
    console.error("[auth] Password reset failed");
    return c.json({ error: "We couldn't reset your password. Please try again." }, 500);
  }
});

function getBearerToken(header: string | undefined) {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim() || null;
}

app.post("/", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    action?: unknown;
    args?: unknown;
  } | null;

  if (!body || typeof body.action !== "string") {
    throw new HTTPException(400, { message: "Invalid auth body" });
  }

  if (body.action !== "auth:signIn" && body.action !== "auth:signOut") {
    throw new HTTPException(400, { message: "Invalid auth action" });
  }

  try {
    const result = await handleDashboardAuthAction(
      {
        action: body.action,
        args:
          body.args && typeof body.args === "object" ? (body.args as Record<string, unknown>) : {},
      },
      {
        db: c.get("db"),
        accessToken: getBearerToken(c.req.header("Authorization")),
        userAgent: c.req.header("User-Agent") ?? null,
        ip: c.get("clientIp") ?? null,
      },
    );

    return c.json(result);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Authentication failed",
      },
      400,
    );
  }
});

export { app as authRouter };
