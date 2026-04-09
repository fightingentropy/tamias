/**
 * Cloudflare Cache purge utilities.
 *
 * Uses Cache Tags to surgically invalidate cached tRPC responses when
 * mutations change the underlying data. Call these in `waitUntil()` after
 * successful mutations.
 *
 * Requires env vars: CLOUDFLARE_ZONE_ID, CLOUDFLARE_CACHE_PURGE_TOKEN
 */

import { logger } from "@tamias/logger";

const ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const PURGE_TOKEN = process.env.CLOUDFLARE_CACHE_PURGE_TOKEN;

async function purgeByTags(tags: string[]): Promise<void> {
  if (!ZONE_ID || !PURGE_TOKEN) {
    // Silently skip in environments without purge configured (dev, staging)
    return;
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PURGE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tags }),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.warn("Cache purge failed", {
        status: response.status,
        tags,
        body: body.slice(0, 200),
      });
    }
  } catch (error) {
    logger.warn("Cache purge error", {
      tags,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Purge all cached tRPC responses for a specific user.
 * Call after user/team mutations to ensure fresh data on next load.
 *
 * @param authorizationHeader - The Authorization header value (Bearer token)
 */
export async function purgeUserCache(authorizationHeader: string): Promise<void> {
  const tokenBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(authorizationHeader),
  );
  const tokenHash = [...new Uint8Array(tokenBytes)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return purgeByTags([`user-${tokenHash}`]);
}

/**
 * Purge all cached tRPC responses for a specific procedure prefix.
 * Call after mutations that affect data exposed by cacheable queries.
 *
 * @param procedurePrefix - e.g. "widgets", "user", "team"
 */
export async function purgeProcedureCache(procedurePrefix: string): Promise<void> {
  return purgeByTags([procedurePrefix]);
}
