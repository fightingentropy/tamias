import { api } from "@tamias/convex-model/api";
import type { Id } from "@tamias/convex-model/data-model";
import { getConvexServiceKey, getSharedConvexClient } from "./convex-client";

function serviceArgs<T extends Record<string, unknown>>(args: T) {
  return {
    serviceKey: getConvexServiceKey(),
    ...args,
  };
}

export async function upsertChatFeedbackInConvex(args: {
  chatId: string;
  messageId: string;
  userId: Id<"appUsers">;
  teamId: string;
  type: "positive" | "negative" | "other";
  comment?: string;
}) {
  return getSharedConvexClient().mutation(
    api.chatFeedback.serviceUpsertChatFeedback,
    serviceArgs(args),
  );
}

export async function deleteChatFeedbackInConvex(args: {
  chatId: string;
  messageId: string;
  userId: Id<"appUsers">;
}) {
  return getSharedConvexClient().mutation(
    api.chatFeedback.serviceDeleteChatFeedback,
    serviceArgs(args),
  );
}
