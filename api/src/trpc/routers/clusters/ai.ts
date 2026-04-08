import { chatsRouter } from "../chats";
import { chatFeedbackRouter } from "../feedback";
import { insightsRouter } from "../insights";

export const aiRouters = {
  chats: chatsRouter,
  chatFeedback: chatFeedbackRouter,
  insights: insightsRouter,
};
