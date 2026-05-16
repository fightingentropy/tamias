import { deleteChatFeedback, upsertChatFeedback } from "@tamias/app-data/queries";
import { createChatFeedbackSchema, deleteChatFeedbackSchema } from "../../schemas/feedback";
import { createTRPCRouter, protectedProcedure } from "../init";

export const chatFeedbackRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createChatFeedbackSchema)
    .mutation(async ({ input, ctx: { db, teamId, session } }) => {
      await upsertChatFeedback(db, {
        chatId: input.chatId,
        messageId: input.messageId,
        userId: session.user.id,
        teamId: teamId!,
        type: input.type,
        comment: input.comment,
      });

      return { success: true };
    }),

  delete: protectedProcedure
    .input(deleteChatFeedbackSchema)
    .mutation(async ({ input, ctx: { db, session } }) => {
      await deleteChatFeedback(db, {
        chatId: input.chatId,
        messageId: input.messageId,
        userId: session.user.id,
      });

      return { success: true };
    }),
});
