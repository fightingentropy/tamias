import { Button } from "@tamias/ui/button";
import { Icons } from "@tamias/ui/icons";
import { Spinner } from "@tamias/ui/spinner";
import { getTellerApplicationId, getTellerEnvironment } from "@tamias/utils/envs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@tamias/ui/tooltip";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useScript } from "usehooks-ts";
import { usePlaidLinkBridge } from "@/components/plaid-link-bridge";
import { useTheme } from "@/components/theme-provider";
import { useTRPC } from "@/trpc/client";

/**
 * Callback type for when a provider reconnect flow completes.
 * - "reconnect": Provider may have changed account IDs, trigger reconnect job
 * - "sync": Provider preserves account IDs (e.g., Plaid update mode), trigger manual sync
 */
type OnCompleteType = "reconnect" | "sync";

type Props = {
  id: string;
  provider: string;
  enrollmentId: string | null;
  institutionId: string;
  referenceId?: string | null;
  accessToken: string | null;
  /**
   * Called when the provider's reconnect flow completes successfully.
   * @param type - "reconnect" if account IDs may have changed, "sync" if they're preserved
   */
  onComplete: (type: OnCompleteType) => void;
  variant?: "button" | "icon";
};

export function ReconnectProvider({
  id,
  provider,
  enrollmentId,
  institutionId,
  referenceId,
  accessToken,
  onComplete,
  variant,
}: Props) {
  const { theme } = useTheme();
  const trpc = useTRPC();
  const tellerApplicationId = getTellerApplicationId();
  const tellerEnvironment = getTellerEnvironment();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingPlaidOpen, setPendingPlaidOpen] = useState(false);
  const { setSession, open, ready } = usePlaidLinkBridge();

  const createPlaidLink = useMutation(
    trpc.banking.plaidLink.mutationOptions({
      onSuccess: (result) => {
        const token = result.data.link_token;
        if (!token) {
          return;
        }

        setSession({
          token,
          onSuccess: () => {
            onComplete("sync");
          },
        });
        setPendingPlaidOpen(true);
      },
    }),
  );

  useScript("https://cdn.teller.io/connect/connect.js", {
    removeOnUnmount: false,
  });

  const openTeller = () => {
    // @ts-expect-error
    const teller = window.TellerConnect.setup({
      applicationId: tellerApplicationId,
      environment: tellerEnvironment,
      enrollmentId,
      appearance: theme,
      onSuccess: () => {
        // Teller may change account IDs after reconnect - trigger reconnect job
        onComplete("reconnect");
      },
      onFailure: () => {},
    });

    if (teller) {
      teller.open();
    }
  };

  useEffect(() => {
    if (!pendingPlaidOpen || !ready) {
      return;
    }

    open();
    setPendingPlaidOpen(false);
  }, [pendingPlaidOpen, ready, open]);

  const handleOnClick = async () => {
    switch (provider) {
      case "plaid": {
        createPlaidLink.mutate({
          accessToken: accessToken ?? undefined,
        });

        return;
      }
      case "teller":
        return openTeller();
      default:
        return;
    }
  };

  if (variant === "button") {
    return (
      <Button variant="outline" onClick={handleOnClick} disabled={isLoading}>
        {isLoading ? <Spinner className="size-3.5" /> : "Reconnect"}
      </Button>
    );
  }

  return (
    <TooltipProvider delayDuration={70}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full w-7 h-7 flex items-center"
            onClick={handleOnClick}
            disabled={isLoading}
          >
            {isLoading ? <Spinner className="size-3.5" /> : <Icons.Reconnect size={16} />}
          </Button>
        </TooltipTrigger>

        <TooltipContent className="px-3 py-1.5 text-xs" sideOffset={10}>
          Reconnect
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
