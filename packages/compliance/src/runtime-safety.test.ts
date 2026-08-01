import { afterEach, describe, expect, test } from "bun:test";
import { assertExternalMutationEnvironment } from "./runtime-safety";

const original = {
  TAMIAS_ENVIRONMENT: process.env.TAMIAS_ENVIRONMENT,
  TAMIAS_LIVE_FILING_ENABLED: process.env.TAMIAS_LIVE_FILING_ENABLED,
  TAMIAS_LIVE_FILING_CONFIRMATION: process.env.TAMIAS_LIVE_FILING_CONFIRMATION,
  TAMIAS_LIVE_PAYMENTS_ENABLED: process.env.TAMIAS_LIVE_PAYMENTS_ENABLED,
  TAMIAS_LIVE_PAYMENTS_CONFIRMATION: process.env.TAMIAS_LIVE_PAYMENTS_CONFIRMATION,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
};

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("live mutation interlocks", () => {
  test("does not gate sandbox or test providers", () => {
    expect(() =>
      assertExternalMutationEnvironment({ kind: "filing", providerEnvironment: "test" }),
    ).not.toThrow();
  });

  test("requires runtime, enable flag, and exact confirmation for live providers", () => {
    process.env.TAMIAS_ENVIRONMENT = "production";
    process.env.TAMIAS_LIVE_FILING_ENABLED = "true";
    process.env.TAMIAS_LIVE_FILING_CONFIRMATION = "wrong";
    expect(() =>
      assertExternalMutationEnvironment({ kind: "filing", providerEnvironment: "production" }),
    ).toThrow("TAMIAS_LIVE_FILING_CONFIRMATION=ENABLE_LIVE_FILING");

    process.env.TAMIAS_LIVE_FILING_CONFIRMATION = "ENABLE_LIVE_FILING";
    expect(() =>
      assertExternalMutationEnvironment({ kind: "filing", providerEnvironment: "production" }),
    ).not.toThrow();
  });

  test("uses an independent live-payment interlock", () => {
    process.env.TAMIAS_ENVIRONMENT = "production";
    process.env.TAMIAS_LIVE_PAYMENTS_ENABLED = "true";
    process.env.TAMIAS_LIVE_PAYMENTS_CONFIRMATION = "ENABLE_LIVE_PAYMENTS";
    expect(() =>
      assertExternalMutationEnvironment({ kind: "payment", providerEnvironment: "live" }),
    ).not.toThrow();

    process.env.TAMIAS_LIVE_PAYMENTS_ENABLED = "false";
    expect(() =>
      assertExternalMutationEnvironment({ kind: "payment", providerEnvironment: "live" }),
    ).toThrow("TAMIAS_LIVE_PAYMENTS_ENABLED=true");
  });

  test("fails closed when a live Stripe credential is mislabeled as sandbox", () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_example_not_a_real_key";
    expect(() =>
      assertExternalMutationEnvironment({ kind: "payment", providerEnvironment: "sandbox" }),
    ).toThrow("TAMIAS_PAYMENT_ENVIRONMENT=live");
  });
});
