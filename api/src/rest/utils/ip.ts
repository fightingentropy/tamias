import type { Context as HonoContext } from "hono";
import type { Context } from "../types";

/**
 * Extract client IP address from request
 * Prioritizes Cloudflare and proxy headers.
 *
 * SECURITY NOTE: This function extracts only the first IP from x-forwarded-for,
 * which is vulnerable to header injection attacks. For security-sensitive endpoints
 * (e.g., webhooks), validate the entire header value directly instead of using this function.
 */
export function getClientIp(c: HonoContext<Context>): string {
  const cfConnectingIp = c.req.header("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Check x-forwarded-for header first (handles proxy/load balancer scenarios)
  // Format: "client-ip, proxy1-ip, proxy2-ip" - we want the first IP
  // WARNING: This is vulnerable to header injection if an attacker controls the header
  const forwardedFor = c.req.header("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = c.req.header("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "";
}
