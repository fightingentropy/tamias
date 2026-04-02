"use client";

import { PolarEmbedCheckout } from "@polar-sh/checkout/embed";
import { track } from "@tamias/events/client";
import { LogEvents } from "@tamias/events/events";
import { PlanCards } from "@tamias/ui/plan-cards";
import { SubmitButton } from "@tamias/ui/submit-button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { useTRPC } from "@/trpc/client";

const POLLING_TIMEOUT_MS = 30_000;

export function Plans() {
  const [checkoutCurrency, setCheckoutCurrency] = useState<"USD" | "EUR">(
    "USD",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPollingForPlan, setIsPollingForPlan] = useState(false);
  const isPollingRef = useRef(false);
  const pollingStartedAtRef = useRef<number | null>(null);
  const trpc = useTRPC();
  const checkoutInstanceRef = useRef<Awaited<
    ReturnType<typeof PolarEmbedCheckout.create>
  > | null>(null);

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
    PolarEmbedCheckout.init();
  }, []);

  useEffect(() => {
    return () => {
      if (checkoutInstanceRef.current) {
        checkoutInstanceRef.current.close();
      }
    };
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

      checkout.addEventListener("confirmed", () => {});
    } catch (error) {
      console.error("Failed to open checkout", error);
      setIsSubmitting(false);
    }
  };

  return (
    <PlanCards
      onCurrencyChange={setCheckoutCurrency}
      renderAction={(billingPeriod) => (
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
      )}
    />
  );
}
