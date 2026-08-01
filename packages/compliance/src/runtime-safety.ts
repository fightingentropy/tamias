export type ExternalMutationKind = "filing" | "payment";

const interlocks = {
  filing: {
    enabled: "TAMIAS_LIVE_FILING_ENABLED",
    confirmation: "TAMIAS_LIVE_FILING_CONFIRMATION",
    expected: "ENABLE_LIVE_FILING",
  },
  payment: {
    enabled: "TAMIAS_LIVE_PAYMENTS_ENABLED",
    confirmation: "TAMIAS_LIVE_PAYMENTS_CONFIRMATION",
    expected: "ENABLE_LIVE_PAYMENTS",
  },
} as const;

export function assertExternalMutationEnvironment(args: {
  kind: ExternalMutationKind;
  providerEnvironment: string;
}) {
  const liveProvider = new Set(["production", "live"]).has(args.providerEnvironment.toLowerCase());
  const stripeCredentialLooksLive =
    args.kind === "payment" && /^(?:sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "");

  if (stripeCredentialLooksLive && !liveProvider) {
    throw new Error(
      "Live Stripe credentials require TAMIAS_PAYMENT_ENVIRONMENT=live before payments can run.",
    );
  }

  if (!liveProvider) {
    return;
  }

  const interlock = interlocks[args.kind];
  if (
    process.env.TAMIAS_ENVIRONMENT !== "production" ||
    process.env[interlock.enabled] !== "true" ||
    process.env[interlock.confirmation] !== interlock.expected
  ) {
    throw new Error(
      `Live ${args.kind} is blocked. Use the production runtime and set ${interlock.enabled}=true plus ${interlock.confirmation}=${interlock.expected}.`,
    );
  }
}
