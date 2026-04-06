import { deleteUserByConvexId } from "@tamias/app-data/queries";
import {
  getCurrentUserFromConvex,
  getCurrentUserFromConvexAsAuthUser,
  getInvitesByEmailFromConvex,
  switchCurrentTeamInConvex,
  updateCurrentUserInConvex,
} from "@tamias/app-services/identity";
import { generateOptionalFileKey } from "@tamias/encryption";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { updateUserSchema } from "../../schemas/users";
import { resend } from "../../services/resend";
import { createTRPCRouter, protectedProcedure } from "../init";

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx: { session, accessToken } }) => {
    const fromAuthUser =
      accessToken && !accessToken.startsWith("mid_")
        ? await getCurrentUserFromConvexAsAuthUser(accessToken)
        : null;

    const result =
      fromAuthUser ??
      (await getCurrentUserFromConvex({
        userId: session.user.convexId,
        email: session.user.email ?? null,
      }));

    if (!result) {
      return undefined;
    }

    return {
      ...result,
      fileKey: await generateOptionalFileKey(result.teamId),
    };
  }),

  update: protectedProcedure
    .input(updateUserSchema)
    .mutation(async ({ ctx: { session }, input }) => {
      const result = await updateCurrentUserInConvex({
        userId: session.user.convexId,
        currentEmail: session.user.email ?? null,
        fullName: input.fullName,
        email: input.email,
        avatarUrl: input.avatarUrl,
        locale: input.locale,
        weekStartsOnMonday: input.weekStartsOnMonday,
        timezone: input.timezone,
        timezoneAutoSync: input.timezoneAutoSync,
        timeFormat:
          input.timeFormat === 12 || input.timeFormat === 24 ? input.timeFormat : undefined,
        dateFormat: input.dateFormat,
        aiProvider: input.aiProvider,
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return {
        ...result,
        fileKey: await generateOptionalFileKey(result.teamId),
      };
    }),

  switchTeam: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .mutation(async ({ ctx: { session }, input }) => {
      try {
        return await switchCurrentTeamInConvex({
          userId: session.user.convexId,
          email: session.user.email ?? null,
          publicTeamId: input.teamId,
        });
      } catch {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this team",
        });
      }
    }),

  delete: protectedProcedure.mutation(async ({ ctx: { db, session } }) => {
    if (!session.user.convexId) {
      throw new Error("Missing Convex user id");
    }

    const [data] = await Promise.all([
      deleteUserByConvexId(db, session.user.convexId),
      resend.contacts.remove({
        email: session.user.email!,
        audienceId: process.env.RESEND_AUDIENCE_ID!,
      }),
    ]);

    return data;
  }),

  invites: protectedProcedure.query(async ({ ctx: { session } }) => {
    if (!session.user.email) {
      return [];
    }

    return getInvitesByEmailFromConvex(session.user.email);
  }),
});
