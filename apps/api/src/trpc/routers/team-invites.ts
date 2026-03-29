import {
  acceptTeamInviteSchema,
  declineTeamInviteSchema,
  deleteTeamInviteSchema,
  inviteTeamMembersSchema,
} from "../../schemas/team";
import {
  acceptTeamInviteInConvex,
  createTeamInvitesInConvex,
  declineTeamInviteInConvex,
  deleteTeamInviteInConvex,
  getInvitesByEmailFromConvex,
} from "@tamias/app-services/identity";
import { enqueue } from "@tamias/job-client";
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../init";
import { requireTeamConvexUserId } from "./team-shared";

type InviteTeamMemberEmail = {
  email: string;
  invitedByName: string;
  invitedByEmail: string;
  teamName: string;
};

export const teamInviteProcedures = {
  acceptInvite: protectedProcedure
    .input(acceptTeamInviteSchema)
    .mutation(async ({ ctx: { session }, input }) => {
      if (!session.user.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Email is required to accept an invite",
        });
      }

      const invites = await getInvitesByEmailFromConvex(session.user.email);
      const invite = invites.find((candidate) => candidate.id === input.id);

      if (!invite || !invite.team?.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invite not found",
        });
      }

      return acceptTeamInviteInConvex({
        publicInviteId: input.id,
        userId: session.user.convexId,
        email: session.user.email,
      });
    }),

  declineInvite: protectedProcedure
    .input(declineTeamInviteSchema)
    .mutation(async ({ ctx: { session }, input }) => {
      if (!session.user.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Email is required to decline an invite",
        });
      }

      return declineTeamInviteInConvex({
        publicInviteId: input.id,
        email: session.user.email,
      });
    }),

  invite: protectedProcedure
    .input(inviteTeamMembersSchema)
    .mutation(async ({ ctx: { session, teamId, geo }, input }) => {
      const invitedByEmail = session.user.email;

      if (!invitedByEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Email is required to invite team members",
        });
      }

      const data = await createTeamInvitesInConvex({
        publicTeamId: teamId!,
        invitedByUserId: requireTeamConvexUserId(session),
        invites: input,
      });
      const results = data?.results ?? [];
      const skippedInvites = data?.skippedInvites ?? [];
      const invites: InviteTeamMemberEmail[] = results.flatMap(
        (invite) => {
          if (!invite?.email) {
            return [];
          }

          return [
            {
              email: invite.email,
              invitedByName: session.user.full_name ?? "",
              invitedByEmail,
              teamName: invite.team?.name ?? "",
            },
          ];
        },
      );

      if (invites.length > 0) {
        await enqueue(
          "invite-team-members",
          {
            teamId: teamId!,
            invites,
            ip: geo.ip ?? "127.0.0.1",
            locale: "en",
          },
          "teams",
          {
            publicTeamId: teamId!,
            appUserId: session.user.convexId,
          },
        );
      }

      return {
        sent: invites.length,
        skipped: skippedInvites.length,
        skippedInvites,
      };
    }),

  deleteInvite: protectedProcedure
    .input(deleteTeamInviteSchema)
    .mutation(async ({ ctx: { teamId }, input }) => {
      return deleteTeamInviteInConvex({
        publicInviteId: input.id,
        publicTeamId: teamId!,
      });
    }),
};
