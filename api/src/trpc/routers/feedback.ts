import {
  deleteChatFeedbackInConvex,
  upsertChatFeedbackInConvex,
} from "@tamias/app-services/chat-feedback";
import { createChatFeedbackSchema, deleteChatFeedbackSchema } from "../../schemas/feedback";
import { createTRPCRouter, protectedProcedure } from "../init";

export const chatFeedbackRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createChatFeedbackSchema)
    .mutation(async ({ input, ctx: { teamId, session } }) => {
      if (!session.user.convexId) {
        throw new Error("Missing Convex user id");
      }

      await upsertChatFeedbackInConvex({
        chatId: input.chatId,
        messageId: input.messageId,
        userId: session.user.convexId,
        teamId: teamId!,
        type: input.type,
        comment: input.comment,
      });

      return { success: true };
    }),

  delete: protectedProcedure
    .input(deleteChatFeedbackSchema)
    .mutation(async ({ input, ctx: { session } }) => {
      if (!session.user.convexId) {
        throw new Error("Missing Convex user id");
      }

      await deleteChatFeedbackInConvex({
        chatId: input.chatId,
        messageId: input.messageId,
        userId: session.user.convexId,
      });

      return { success: true };
    }),
});
