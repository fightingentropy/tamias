import {
  deleteTeamMemberInConvex,
  getTeamMembersFromConvex,
  updateTeamMemberInConvex,
} from "@tamias/app-services/identity";
import { TRPCError } from "@trpc/server";
import { deleteTeamMemberSchema, updateTeamMemberSchema } from "../../schemas/team";
import { protectedProcedure } from "../init";
import {
  getTeamMemberByPublicId,
  getTeamMemberRoleByConvexId,
  getTeamMemberRoleByPublicId,
  getTeamOwnerCount,
} from "./team-shared";

export const teamMemberProcedures = {
  deleteMember: protectedProcedure
    .input(deleteTeamMemberSchema)
    .mutation(async ({ ctx: { session, teamId }, input }) => {
      if (input.teamId !== teamId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this team",
        });
      }

      const teamMembers = await getTeamMembersFromConvex(teamId!);
      const callerRole = getTeamMemberRoleByConvexId(teamMembers, session.user.id);

      if (callerRole !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only team owners can remove members",
        });
      }

      const targetRole = getTeamMemberRoleByPublicId(teamMembers, input.userId);
      const targetMember = getTeamMemberByPublicId(teamMembers, input.userId);

      if (!targetMember) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team member not found",
        });
      }

      if (targetRole === "owner" && getTeamOwnerCount(teamMembers) === 1) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot remove the last team owner",
        });
      }

      return deleteTeamMemberInConvex({
        publicTeamId: input.teamId,
        userId: targetMember.user.convexId,
      });
    }),

  updateMember: protectedProcedure
    .input(updateTeamMemberSchema)
    .mutation(async ({ ctx: { session, teamId }, input }) => {
      if (input.teamId !== teamId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this team",
        });
      }

      const teamMembers = await getTeamMembersFromConvex(teamId!);
      const callerRole = getTeamMemberRoleByConvexId(teamMembers, session.user.id);

      if (callerRole !== "owner") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only team owners can update member roles",
        });
      }

      if (input.role === "member") {
        const targetRole = getTeamMemberRoleByPublicId(teamMembers, input.userId);

        if (targetRole === "owner" && getTeamOwnerCount(teamMembers) === 1) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot demote the last team owner",
          });
        }
      }

      const targetMember = getTeamMemberByPublicId(teamMembers, input.userId);

      if (!targetMember) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Team member not found",
        });
      }

      return updateTeamMemberInConvex({
        publicTeamId: input.teamId,
        userId: targetMember.user.convexId,
        role: input.role,
      });
    }),
};
