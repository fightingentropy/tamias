import { deleteUser } from "@tamias/app-data/queries";
import {
  getCurrentUser,
  getInvitesByEmail,
  switchCurrentTeam,
  updateCurrentUser,
} from "@tamias/app-services/identity";
import { generateOptionalFileKey } from "@tamias/encryption";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { updateUserSchema } from "../../schemas/users";
import { createTRPCRouter, protectedProcedure } from "../init";

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx: { session } }) => {
    const result = await getCurrentUser({
      userId: session.user.id,
      email: session.user.email ?? null,
    });

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
      const result = await updateCurrentUser({
        userId: session.user.id,
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
        return await switchCurrentTeam({
          userId: session.user.id,
          email: session.user.email ?? null,
          teamId: input.teamId,
        });
      } catch {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this team",
        });
      }
    }),

  delete: protectedProcedure.mutation(async ({ ctx: { db, session } }) => {
    return deleteUser(db, session.user.id);
  }),

  invites: protectedProcedure.query(async ({ ctx: { session } }) => {
    if (!session.user.email) {
      return [];
    }

    return getInvitesByEmail(session.user.email);
  }),
});
