"use client";

import type { RouterOutputs } from "@tamias/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "@tamias/ui/avatar";
import { SubmitButton } from "@tamias/ui/submit-button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/framework/navigation";
import { useTRPC } from "@/trpc/client";

type Props = {
  invite: RouterOutputs["team"]["invitesByEmail"][number];
};

export function TeamInvite({ invite }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const switchTeamMutation = useMutation(
    trpc.user.switchTeam.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        router.push("/dashboard");
      },
    }),
  );

  const acceptInviteMutation = useMutation(
    trpc.team.acceptInvite.mutationOptions({
      onSuccess: (data) => {
        if (!data.teamId) {
          return;
        }

        // Switch to the newly joined team
        switchTeamMutation.mutate({
          teamId: data.teamId,
        });
      },
    }),
  );

  const declineInviteMutation = useMutation(
    trpc.team.declineInvite.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.team.invitesByEmail.queryKey(),
        });
      },
    }),
  );

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-4">
        <Avatar className="size-8 rounded-none">
          <AvatarImage
            src={invite.team?.logoUrl ?? ""}
            className="rounded-none"
            width={32}
            height={32}
          />
          <AvatarFallback className="rounded-none">
            <span className="text-xs">
              {invite.team?.name?.charAt(0)?.toUpperCase()}
            </span>
          </AvatarFallback>
        </Avatar>

        <span className="text-sm font-medium">{invite.team?.name}</span>
      </div>

      <div className="flex gap-2">
        <SubmitButton
          isSubmitting={acceptInviteMutation.isPending}
          variant="outline"
          onClick={() =>
            acceptInviteMutation.mutate({
              id: invite.id,
            })
          }
        >
          Accept
        </SubmitButton>
        <SubmitButton
          isSubmitting={declineInviteMutation.isPending}
          variant="outline"
          onClick={() =>
            declineInviteMutation.mutate({
              id: invite.id,
            })
          }
        >
          Decline
        </SubmitButton>
      </div>
    </div>
  );
}
