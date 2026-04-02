
import type { UIChatMessage } from "@tamias/contracts/chat";
import { getChatMessages } from "@tamias/app-services/chat-memory";
import { cache } from "react";
import { measureServerRead } from "@/server/perf";
import { getCurrentSession } from "./context";
import type { LocalChatMessages } from "./types";

export const getChatMessagesLocally = cache(
  async (chatId: string): Promise<LocalChatMessages> => {
    return measureServerRead("getChatMessagesLocally", async () => {
      const session = await getCurrentSession();

      if (!session?.teamId) {
        return [];
      }

      return getChatMessages<UIChatMessage>({
        chatId,
        userId: session.user.id,
        teamId: session.teamId,
        limit: 50,
      });
    });
  },
);
