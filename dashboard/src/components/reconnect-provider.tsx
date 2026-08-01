import { Button } from "@tamias/ui/button";
import { Icons } from "@tamias/ui/icons";
import { Spinner } from "@tamias/ui/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@tamias/ui/tooltip";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

type Props = {
  id: string;
  provider: string;
  institutionId: string;
  referenceId?: string | null;
  variant?: "button" | "icon";
};

export function ReconnectProvider({ id, provider, institutionId, variant }: Props) {
  const trpc = useTRPC();
  const createTrueLayerLink = useMutation(
    trpc.banking.truelayerAuthUrl.mutationOptions({
      onSuccess: (result) => {
        if (result?.url) {
          window.location.assign(result.url);
        }
      },
    }),
  );

  const openTrueLayer = () => {
    createTrueLayerLink.mutate({ institutionId, reconnect: true, connectionId: id });
  };

  const handleOnClick = async () => {
    if (provider === "truelayer") {
      openTrueLayer();
    }
  };

  const isLoading = createTrueLayerLink.isPending;

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
