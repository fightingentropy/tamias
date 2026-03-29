import type { UIChatMessage } from "@tamias/contracts/chat";
import {
  deleteChatSchema,
  getChatSchema,
  listChatsSchema,
} from "../../schemas/chat";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  deleteChatSession,
  getChatMessages,
  listChatSessions,
} from "@tamias/app-services/chat-memory";
import { TRPCError } from "@trpc/server";

export const chatsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(listChatsSchema)
    .query(async ({ ctx, input }) => {
      return listChatSessions({
        userId: ctx.session.user.id,
        teamId: ctx.teamId!,
        search: input.search,
        limit: input.limit ?? 50,
      });
    }),

  get: protectedProcedure.input(getChatSchema).query(async ({ ctx, input }) => {
    return getChatMessages<UIChatMessage>({
      chatId: input.chatId,
      userId: ctx.session.user.id,
      teamId: ctx.teamId!,
      limit: 50,
    });
  }),

  delete: protectedProcedure
    .input(deleteChatSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify ownership first since deleteChat may not support userId parameter
      try {
        await deleteChatSession({
          chatId: input.chatId,
          userId: ctx.session.user.id,
          teamId: ctx.teamId!,
        });
      } catch (_error) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to delete this chat",
        });
      }

      return { deleted: true };
    }),
});
