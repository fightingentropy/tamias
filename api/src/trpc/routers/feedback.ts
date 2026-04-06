import {
  deleteChatFeedbackInConvex,
  upsertChatFeedbackInConvex,
} from "@tamias/app-services/chat-feedback";
import { createChatFeedbackSchema, deleteChatFeedbackSchema } from "../../schemas/feedback";
import { createTRPCRouter, protectedWithConvexIdProcedure } from "../init";

export const chatFeedbackRouter = createTRPCRouter({
  create: protectedWithConvexIdProcedure
    .input(createChatFeedbackSchema)
    .mutation(async ({ input, ctx: { teamId, session } }) => {
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

  delete: protectedWithConvexIdProcedure
    .input(deleteChatFeedbackSchema)
    .mutation(async ({ input, ctx: { session } }) => {
      await deleteChatFeedbackInConvex({
        chatId: input.chatId,
        messageId: input.messageId,
        userId: session.user.convexId,
      });

      return { success: true };
    }),
});
