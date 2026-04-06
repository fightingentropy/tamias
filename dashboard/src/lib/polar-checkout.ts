"use client";

export type PolarCheckoutEventHandler = (event: any) => void;

export type PolarCheckout = {
  close: () => void;
  addEventListener: (
    eventName: "success" | "close" | "confirmed",
    handler: PolarCheckoutEventHandler,
  ) => void;
};

type PolarEmbedCheckoutApi = {
  init: () => void;
  create: (url: string, options?: { theme?: string }) => Promise<PolarCheckout>;
};

let polarEmbedCheckoutPromise: Promise<PolarEmbedCheckoutApi> | null = null;

export function getPolarEmbedCheckout() {
  if (!polarEmbedCheckoutPromise) {
    polarEmbedCheckoutPromise = import("@polar-sh/checkout/embed").then(
      (module) => {
        const PolarEmbedCheckout = module.PolarEmbedCheckout as PolarEmbedCheckoutApi;
        PolarEmbedCheckout.init();
        return PolarEmbedCheckout;
      },
    );
  }

  return polarEmbedCheckoutPromise;
}
