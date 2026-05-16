import type { Database } from "../client";
import {
  deleteChatFeedbackFromD1,
  getChatFeedbackD1,
  upsertChatFeedbackInD1,
} from "./chat-feedback/d1";

export type ChatFeedbackType = "positive" | "negative" | "other";

function requireChatFeedbackD1(db: Database) {
  const d1 = getChatFeedbackD1(db);

  if (!d1) {
    throw new Error("Chat feedback requires Cloudflare D1");
  }

  return d1;
}

export type UpsertChatFeedbackParams = {
  chatId: string;
  messageId: string;
  userId: string;
  teamId: string;
  type: ChatFeedbackType;
  comment?: string;
};

export type DeleteChatFeedbackParams = {
  chatId: string;
  messageId: string;
  userId: string;
};

export async function upsertChatFeedback(db: Database, params: UpsertChatFeedbackParams) {
  await upsertChatFeedbackInD1(requireChatFeedbackD1(db), params);

  return { success: true };
}

export async function deleteChatFeedback(db: Database, params: DeleteChatFeedbackParams) {
  await deleteChatFeedbackFromD1(requireChatFeedbackD1(db), params);

  return { success: true };
}
