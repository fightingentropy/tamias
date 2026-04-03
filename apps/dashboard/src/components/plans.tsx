"use client";

import { track } from "@tamias/events/client";
import { LogEvents } from "@tamias/events/events";
import { getPlanPricing, planFeatures } from "@tamias/plans";
import { SubmitButton } from "@tamias/ui/submit-button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import {
  getPolarEmbedCheckout,
  type PolarCheckout,
} from "@/lib/polar-checkout";
import { useTRPC } from "@/trpc/client";

const POLLING_TIMEOUT_MS = 30_000;
const BILLING_HIGHLIGHTS = planFeatures.slice(0, 6);

export function Plans() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "yearly",
  );
  const [checkoutCurrency, setCheckoutCurrency] = useState<"USD" | "EUR">(
    "USD",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPollingForPlan, setIsPollingForPlan] = useState(false);
  const isPollingRef = useRef(false);
  const pollingStartedAtRef = useRef<number | null>(null);
  const trpc = useTRPC();
  const checkoutInstanceRef = useRef<PolarCheckout | null>(null);

  const { data: user } = useQuery({
    ...trpc.user.me.queryOptions(),
    refetchInterval: (query) => {
      if (!isPollingForPlan) return false;

      const plan = query.state.data?.team?.plan;
      if (plan && plan !== "trial") {
        return false;
      }

      if (
        pollingStartedAtRef.current &&
        Date.now() - pollingStartedAtRef.current > POLLING_TIMEOUT_MS
      ) {
        return false;
      }

      return 1500;
    },
  });
  const theme = useTheme().resolvedTheme === "dark" ? "dark" : "light";

  useEffect(() => {
    return () => {
      if (checkoutInstanceRef.current) {
        checkoutInstanceRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz?.startsWith("Europe/")) {
        setCheckoutCurrency("EUR");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!isPollingForPlan) return;

    const isTimedOut =
      pollingStartedAtRef.current &&
      Date.now() - pollingStartedAtRef.current > POLLING_TIMEOUT_MS;
    const plan = user?.team?.plan;
    const planUpdated = plan != null && plan !== "trial";

    if (planUpdated || isTimedOut) {
      pollingStartedAtRef.current = null;
      setIsPollingForPlan(false);
      isPollingRef.current = false;

      if (isTimedOut && !planUpdated) {
        setIsSubmitting(false);
      }

      window.location.assign("/dashboard");
    }
  }, [isPollingForPlan, user?.team?.plan]);

  const createCheckoutMutation = useMutation(
    trpc.billing.createCheckout.mutationOptions(),
  );

  const handleCheckout = async (planType: string) => {
    try {
      setIsSubmitting(true);

      track({
        event: LogEvents.CheckoutStarted.name,
        channel: LogEvents.CheckoutStarted.channel,
        plan: "starter",
        planType,
        currency: checkoutCurrency,
      });

      const { url } = await createCheckoutMutation.mutateAsync({
        plan: "starter",
        planType,
        embedOrigin: window.location.origin,
        currency: checkoutCurrency,
      });

      const PolarEmbedCheckout = await getPolarEmbedCheckout();
      const checkout = await PolarEmbedCheckout.create(url, {
        theme,
      });
      checkoutInstanceRef.current = checkout;

      checkout.addEventListener("success", (event: any) => {
        event.preventDefault();

        track({
          event: LogEvents.CheckoutCompleted.name,
          channel: LogEvents.CheckoutCompleted.channel,
          plan: "starter",
          planType,
          currency: checkoutCurrency,
        });

        pollingStartedAtRef.current = Date.now();
        isPollingRef.current = true;
        setIsPollingForPlan(true);
      });

      checkout.addEventListener("close", () => {
        checkoutInstanceRef.current = null;
        if (!isPollingRef.current) {
          setIsSubmitting(false);
        }
      });
    } catch (error) {
      console.error("Failed to open checkout", error);
      setIsSubmitting(false);
    }
  };

  const pricing = getPlanPricing(checkoutCurrency === "EUR" ? "EU" : undefined);
  const monthlyPrice =
    billingPeriod === "monthly"
      ? pricing.starter.monthly
      : pricing.starter.yearly;
  const annualPrice = pricing.starter.yearly * 12;
  const annualSavings =
    (pricing.starter.monthly - pricing.starter.yearly) * 12;

  return (
    <div className="w-full max-w-[560px] mx-auto">
      <div className="border border-border p-6 sm:p-8 lg:p-10">
        <div className="flex justify-center mb-10">
          <div className="relative flex items-stretch bg-muted">
            <button
              type="button"
              onClick={() => setBillingPeriod("monthly")}
              className={`px-3 py-1.5 h-9 text-[14px] border transition-colors ${
                billingPeriod === "monthly"
                  ? "text-foreground bg-background border-border"
                  : "text-muted-foreground hover:text-foreground bg-muted border-transparent"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod("yearly")}
              className={`px-3 py-1.5 h-9 text-[14px] border transition-colors ${
                billingPeriod === "yearly"
                  ? "text-foreground bg-background border-border"
                  : "text-muted-foreground hover:text-foreground bg-muted border-transparent"
              }`}
            >
              Yearly (Save 20%)
            </button>
          </div>
        </div>

        <div className="text-center mb-10">
          <div className="flex items-baseline justify-center gap-3">
            <span className="font-sans text-[80px] leading-none text-foreground font-light tracking-tight">
              {pricing.symbol}
              {monthlyPrice}
            </span>
            <span className="font-sans text-lg text-muted-foreground">
              /month
            </span>
          </div>
          <p className="font-sans text-sm text-muted-foreground mt-3">
            {billingPeriod === "monthly"
              ? "Billed monthly"
              : `${pricing.symbol}${annualPrice}/year billed annually`}
          </p>
        </div>

        <div className="max-w-[280px] mx-auto">
          <SubmitButton
            className="w-full btn-inverse font-sans text-sm py-3 px-4 transition-colors"
            onClick={() =>
              handleCheckout(
                billingPeriod === "yearly" ? "starter_yearly" : "starter",
              )
            }
            isSubmitting={isSubmitting}
          >
            Upgrade
          </SubmitButton>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0 max-w-fit mx-auto">
          {BILLING_HIGHLIGHTS.map((feature) => (
            <div key={feature.label} className="flex items-center gap-2 h-7">
              <span className="text-foreground shrink-0 leading-none">•</span>
              <span className="font-sans text-sm text-foreground font-normal">
                {feature.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="font-sans text-xs text-muted-foreground mt-8 text-center">
        {billingPeriod === "yearly" && (
          <>
            Save {pricing.symbol}
            {annualSavings}/year ·{" "}
          </>
        )}
        <button
          type="button"
          onClick={() => setCheckoutCurrency("USD")}
          className={
            checkoutCurrency === "USD"
              ? "underline underline-offset-4"
              : "hover:text-foreground transition-colors"
          }
        >
          USD
        </button>
        {" / "}
        <button
          type="button"
          onClick={() => setCheckoutCurrency("EUR")}
          className={
            checkoutCurrency === "EUR"
              ? "underline underline-offset-4"
              : "hover:text-foreground transition-colors"
          }
        >
          EUR
        </button>
        {" · Excl. tax"}
      </p>
    </div>
  );
}
