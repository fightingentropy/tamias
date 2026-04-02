"use client";

import { Icons } from "@tamias/ui/icons";
import { SubmitButton } from "@tamias/ui/submit-button";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@/framework/navigation";
import { useTRPC } from "@/trpc/client";

type Props = {
  redirectPath?: string;
};

export function ConnectOutlook({ redirectPath }: Props) {
  const trpc = useTRPC();
  const router = useRouter();

  const connectMutation = useMutation(
    trpc.inboxAccounts.connect.mutationOptions({
      onSuccess: (authUrl) => {
        if (authUrl) {
          router.push(authUrl);
        }
      },
    }),
  );

  return (
    <SubmitButton
      className="px-4 font-medium h-[40px]"
      variant="outline"
      onClick={() =>
        connectMutation.mutate({ provider: "outlook", redirectPath })
      }
      isSubmitting={connectMutation.isPending}
    >
      <div className="flex items-center space-x-2">
        <Icons.Outlook />
        <span>Connect Outlook</span>
      </div>
    </SubmitButton>
  );
}
