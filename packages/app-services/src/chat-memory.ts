import { ConvexChatMemoryProvider } from "@tamias/app-data-convex";

export const chatMemoryProvider = new ConvexChatMemoryProvider();

function getScopedUserId(userId: string, teamId: string) {
  return `${userId}:${teamId}`;
}

export async function listChatSessions(args: {
  userId: string;
  teamId: string;
  search?: string;
  limit?: number;
}) {
  return chatMemoryProvider.getChats({
    userId: getScopedUserId(args.userId, args.teamId),
    search: args.search,
    limit: args.limit ?? 50,
  });
}

export async function getChatMessages<T = unknown>(args: {
  chatId: string;
  userId: string;
  teamId: string;
  limit?: number;
}) {
  return chatMemoryProvider.getMessages<T>({
    chatId: args.chatId,
    userId: getScopedUserId(args.userId, args.teamId),
    limit: args.limit ?? 50,
  });
}

export async function deleteChatSession(args: {
  chatId: string;
  userId: string;
  teamId: string;
}) {
  await getChatMessages({
    chatId: args.chatId,
    userId: args.userId,
    teamId: args.teamId,
    limit: 1,
  });

  return chatMemoryProvider.deleteChat(args.chatId);
}
