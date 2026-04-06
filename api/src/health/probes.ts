/**
 * Lightweight probe functions for external services.
 *
 * Each probe should be the cheapest possible verification:
 * - No side effects
 * - Minimal data transfer
 * - Fast timeout
 */

import { Provider } from "@tamias/banking";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { Dependency } from "./registry";

// ---------------------------------------------------------------------------
// Tier 1 — Core infrastructure (app breaks without these)
// ---------------------------------------------------------------------------

const convexHealthPingRef = makeFunctionReference<
  "query",
  Record<string, never>,
  boolean
>("health:ping");

/** Convex: run a no-op public query against the active deployment */
export function convexProbe(): Dependency {
  return {
    name: "convex",
    tier: 1,
    timeoutMs: 3_000,
    probe: async () => {
      const url =
        process.env.CONVEX_URL ||
        process.env.TAMIAS_CONVEX_URL ||
        process.env.CONVEX_SITE_URL;

      if (!url) {
        throw new Error("CONVEX_URL not set");
      }

      const client = new ConvexHttpClient(url, { logger: false });
      const response = await client.query(convexHealthPingRef, {});

      return response === true;
    },
  };
}

// ---------------------------------------------------------------------------
// Tier 2 — Important services
// ---------------------------------------------------------------------------

/** Plaid health check via @tamias/banking */
export function plaidProbe(): Dependency {
  return {
    name: "plaid",
    tier: 2,
    timeoutMs: 5_000,
    probe: async () => {
      try {
        const provider = new Provider({ provider: "plaid" });
        return await provider.getHealthCheck().then((h) => h.plaid.healthy);
      } catch {
        return false;
      }
    },
  };
}

/** GoCardless health check via @tamias/banking */
export function gocardlessProbe(): Dependency {
  return {
    name: "gocardless",
    tier: 2,
    timeoutMs: 5_000,
    probe: async () => {
      try {
        const provider = new Provider({ provider: "gocardless" });
        return await provider
          .getHealthCheck()
          .then((h) => h.gocardless.healthy);
      } catch {
        return false;
      }
    },
  };
}

/** Teller health check via @tamias/banking */
export function tellerProbe(): Dependency {
  return {
    name: "teller",
    tier: 2,
    timeoutMs: 5_000,
    probe: async () => {
      try {
        const provider = new Provider({ provider: "teller" });
        return await provider.getHealthCheck().then((h) => h.teller.healthy);
      } catch {
        return false;
      }
    },
  };
}

/** Stripe: GET /v1/balance (cheapest authenticated endpoint) */
export function stripeProbe(): Dependency {
  return {
    name: "stripe",
    tier: 2,
    timeoutMs: 5_000,
    probe: async () => {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) return false;
      const res = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    },
  };
}

/** Resend: GET /emails (lightweight API check) */
export function resendProbe(): Dependency {
  return {
    name: "resend",
    tier: 2,
    timeoutMs: 5_000,
    probe: async () => {
      const key = process.env.RESEND_API_KEY;
      if (!key) return false;
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    },
  };
}

/** Polar: GET /v1/products (lightweight authenticated check) */
export function polarProbe(): Dependency {
  return {
    name: "polar",
    tier: 2,
    timeoutMs: 5_000,
    probe: async () => {
      const token = process.env.POLAR_ACCESS_TOKEN;
      if (!token) return false;
      const baseUrl =
        process.env.POLAR_ENVIRONMENT === "sandbox"
          ? "https://sandbox-api.polar.sh"
          : "https://api.polar.sh";
      const res = await fetch(`${baseUrl}/v1/products/?limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    },
  };
}

/** OpenAI: GET /v1/models (lightweight list) */
export function openaiProbe(): Dependency {
  return {
    name: "openai",
    tier: 2,
    timeoutMs: 5_000,
    probe: async () => {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return false;
      const res = await fetch("https://api.openai.com/v1/models?limit=1", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    },
  };
}

// ---------------------------------------------------------------------------
// Tier 3 — Integrations (check token endpoint reachability)
// ---------------------------------------------------------------------------

function oauthTokenProbe(name: string, tokenUrl: string): Dependency {
  return {
    name,
    tier: 3,
    timeoutMs: 5_000,
    probe: async () => {
      // Use POST — some OAuth token endpoints reject HEAD/GET with 501.
      // An empty POST will get 400 (invalid_request) which proves reachability.
      const res = await fetch(tokenUrl, {
        method: "POST",
        signal: AbortSignal.timeout(5_000),
      }).catch(() => null);
      // Any non-network response means the endpoint is reachable
      return res !== null && res.status < 500;
    },
  };
}

export function slackProbe(): Dependency {
  return oauthTokenProbe("slack", "https://slack.com/api/api.test");
}

export function xeroProbe(): Dependency {
  return oauthTokenProbe("xero", "https://identity.xero.com/connect/token");
}

export function quickbooksProbe(): Dependency {
  return oauthTokenProbe(
    "quickbooks",
    "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
  );
}

export function fortnoxProbe(): Dependency {
  return oauthTokenProbe("fortnox", "https://apps.fortnox.se/oauth-v1/token");
}

// ---------------------------------------------------------------------------
// Tier 4 — Optional services
// ---------------------------------------------------------------------------

/** Google AI: lightweight models list */
export function googleAiProbe(): Dependency {
  return {
    name: "google_ai",
    tier: 4,
    timeoutMs: 5_000,
    probe: async () => {
      const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!key) return false;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=1`,
        { signal: AbortSignal.timeout(5_000) },
      );
      return res.ok;
    },
  };
}

/** ElevenLabs: API reachability */
export function elevenLabsProbe(): Dependency {
  return {
    name: "elevenlabs",
    tier: 4,
    timeoutMs: 5_000,
    probe: async () => {
      const key = process.env.ELEVENLABS_API_KEY;
      if (!key) return false;
      const res = await fetch("https://api.elevenlabs.io/v1/models", {
        headers: { "xi-api-key": key },
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    },
  };
}

/** Exa: API reachability */
export function exaProbe(): Dependency {
  return {
    name: "exa",
    tier: 4,
    timeoutMs: 5_000,
    probe: async () => {
      const key = process.env.EXA_API_KEY;
      if (!key) return false;
      const res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: "health", numResults: 0 }),
        signal: AbortSignal.timeout(5_000),
      });
      // 400 is fine — means the API is reachable and authenticated
      return res.status < 500;
    },
  };
}

/** Plain: API reachability */
export function plainProbe(): Dependency {
  return {
    name: "plain",
    tier: 4,
    timeoutMs: 5_000,
    probe: async () => {
      const key = process.env.PLAIN_API_KEY;
      if (!key) return false;
      const res = await fetch("https://core-api.uk.plain.com/graphql/v1", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: "{ myWorkspace { id } }" }),
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    },
  };
}

/** Mistral AI: models list */
export function mistralProbe(): Dependency {
  return {
    name: "mistral",
    tier: 4,
    timeoutMs: 5_000,
    probe: async () => {
      const key = process.env.MISTRAL_API_KEY;
      if (!key) return false;
      const res = await fetch("https://api.mistral.ai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    },
  };
}

// ---------------------------------------------------------------------------
// Pre-built registry sets for each service
// ---------------------------------------------------------------------------

/** Dependencies used by the API service */
export function apiDependencies(): Dependency[] {
  const dependencies: Dependency[] = [
    // Tier 1 — Core
    convexProbe(),
    // Tier 2 — Important
    plaidProbe(),
    gocardlessProbe(),
    tellerProbe(),
    stripeProbe(),
    polarProbe(),
    resendProbe(),
    openaiProbe(),
    // Tier 3 — Integrations
    slackProbe(),
    xeroProbe(),
    quickbooksProbe(),
    fortnoxProbe(),
    // Tier 4 — Optional
    googleAiProbe(),
    mistralProbe(),
    plainProbe(),
  ];

  return dependencies;
}
