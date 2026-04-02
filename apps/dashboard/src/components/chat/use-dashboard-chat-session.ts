"use client";

import {
  useChat,
  useChatActions,
  useChatId,
  useDataPart,
} from "@ai-sdk-tools/store";
import { useAuthToken } from "@convex-dev/auth/react";
import type { UIChatMessage } from "@tamias/contracts/chat";
import { getApiUrl } from "@tamias/utils/envs";
import { DefaultChatTransport, generateId } from "ai";
import { useEffect, useMemo, useRef } from "react";
import { useCurrentUser } from "@/components/current-user-provider";
import { useChatInterface } from "@/hooks/use-chat-interface";
import { useMetricsFilter } from "@/hooks/use-metrics-filter";
import type { Geo } from "@/utils/geo";

type Props = {
  geo?: Geo;
};

export function useDashboardChatSession({ geo }: Props) {
  const token = useAuthToken();
  const apiUrl = getApiUrl();
  const user = useCurrentUser();
  const storedChatId = useChatId();
  const { chatId: routeChatId } = useChatInterface();
  const chatId = useMemo(
    () => routeChatId ?? storedChatId ?? generateId(),
    [routeChatId, storedChatId],
  );
  const { reset } = useChatActions();
  const prevChatIdRef = useRef<string | null>(routeChatId);
  const [, clearSuggestions] = useDataPart<{ prompts: string[] }>(
    "suggestions",
  );

  const { period, from, to, currency, revenueType } = useMetricsFilter();

  useEffect(() => {
    const prevChatId = prevChatIdRef.current;
    const currentChatId = routeChatId;

    if (prevChatId && prevChatId !== currentChatId) {
      reset();
      clearSuggestions();
    }

    prevChatIdRef.current = currentChatId;
  }, [routeChatId, reset, clearSuggestions]);

  const authenticatedFetch = useMemo(
    () =>
      Object.assign(
        async (url: RequestInfo | URL, requestOptions?: RequestInit) => {
          if (!token) {
            throw new Error("Not authenticated");
          }

          return fetch(url, {
            ...requestOptions,
            headers: {
              ...requestOptions?.headers,
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });
        },
      ),
    [token],
  );

  return useChat<UIChatMessage>({
    id: chatId,
    transport: new DefaultChatTransport({
      api: `${apiUrl}/chat`,
      fetch: authenticatedFetch,
      prepareSendMessagesRequest({ messages, id }) {
        const lastMessage = messages[messages.length - 1] as UIChatMessage;

        return {
          body: {
            id,
            country: geo?.country,
            city: geo?.city,
            message: lastMessage,
            agentChoice: lastMessage?.metadata?.agentChoice,
            toolChoice: lastMessage?.metadata?.toolChoice,
            aiProvider: user.aiProvider,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            metricsFilter: { period, from, to, currency, revenueType },
          },
        };
      },
    }),
  });
}
