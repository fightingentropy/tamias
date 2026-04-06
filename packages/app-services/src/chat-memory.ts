import { ConvexChatMemoryProvider } from "@tamias/app-data-convex/chat-memory";

let chatMemoryProviderSingleton: ConvexChatMemoryProvider | undefined;

function getChatMemoryProvider(): ConvexChatMemoryProvider {
  chatMemoryProviderSingleton ??= new ConvexChatMemoryProvider();
  return chatMemoryProviderSingleton;
}

/**
 * Lazily constructs the provider so bundled workers do not instantiate it during
 * circular ESM evaluation (e.g. convex barrel ↔ Stripe webhook modules).
 */
export const chatMemoryProvider = new Proxy({} as ConvexChatMemoryProvider, {
  get(_target, prop: string | symbol) {
    if (prop === "then") {
      return undefined;
    }
    const inst = getChatMemoryProvider();
    const value = inst[prop as keyof ConvexChatMemoryProvider];
    if (typeof value === "function") {
      return (value as (...args: never[]) => unknown).bind(inst);
    }
    return value;
  },
});

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

export async function deleteChatSession(args: { chatId: string; userId: string; teamId: string }) {
  await getChatMessages({
    chatId: args.chatId,
    userId: args.userId,
    teamId: args.teamId,
    limit: 1,
  });

  return chatMemoryProvider.deleteChat(args.chatId);
}
