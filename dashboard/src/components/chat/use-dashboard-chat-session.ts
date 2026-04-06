"use client";

import { useChatActions, useChat, useChatId, useDataPart } from "@ai-sdk-tools/store";
import type { UIChatMessage } from "@tamias/contracts/chat";
import { getApiUrl } from "@tamias/utils/envs";
import { useQuery } from "@tanstack/react-query";
import { DefaultChatTransport, generateId } from "ai";
import { useEffect, useMemo, useRef } from "react";
import { useAuthToken } from "@/framework/auth-client";
import { useChatInterface } from "@/hooks/use-chat-interface";
import { useMetricsFilter } from "@/hooks/use-metrics-filter";
import { useTRPC } from "@/trpc/client";
import type { Geo } from "@/utils/geo";

type Props = {
  geo?: Geo;
};

export function useDashboardChatSession({ geo }: Props) {
  const token = useAuthToken();
  const apiUrl = getApiUrl();
  const trpc = useTRPC();
  const storedChatId = useChatId();
  const { chatId: routeChatId } = useChatInterface();
  const { data: user } = useQuery({
    ...trpc.user.me.queryOptions(),
    enabled: Boolean(token),
    staleTime: 6 * 60 * 60 * 1000,
    refetchInterval: 6 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const chatId = useMemo(
    () => routeChatId ?? storedChatId ?? generateId(),
    [routeChatId, storedChatId],
  );
  const { reset } = useChatActions();
  const prevChatIdRef = useRef<string | null>(routeChatId);
  const [, clearSuggestions] = useDataPart<{ prompts: string[] }>("suggestions");

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
      Object.assign(async (url: RequestInfo | URL, requestOptions?: RequestInit) => {
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
      }),
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
            aiProvider: user?.aiProvider ?? "openai",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            metricsFilter: { period, from, to, currency, revenueType },
          },
        };
      },
    }),
  });
}
