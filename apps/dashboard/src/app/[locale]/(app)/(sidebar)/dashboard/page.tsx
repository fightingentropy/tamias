import { Provider as ChatProvider } from "@ai-sdk-tools/store";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { ChatInterface } from "@/components/chat/chat-interface";
import { Widgets } from "@/components/widgets";
import {
  getCurrentWidgetPreferencesLocally,
  getSuggestedActionsLocally,
} from "@/server/loaders/widgets";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import { geolocation } from "@/utils/geo";

export const metadata: Metadata = {
  title: "Dashboard | Tamias",
};

export default async function DashboardPage() {
  const headersList = await headers();
  const geo = geolocation(headersList);

  const queryClient = getQueryClient();

  const suggestedActionsQuery = trpc.suggestedActions.list.queryOptions({
    limit: 6,
  });
  const [widgetPreferences, suggestedActions] = await Promise.all([
    getCurrentWidgetPreferencesLocally(),
    getSuggestedActionsLocally(6),
  ]);

  queryClient.setQueryData(
    trpc.widgets.getWidgetPreferences.queryKey(),
    widgetPreferences,
  );
  queryClient.setQueryData(suggestedActionsQuery.queryKey, suggestedActions);

  return (
    <HydrateClient>
      <ChatProvider initialMessages={[]} key="home">
        <Widgets initialPreferences={widgetPreferences} />

        <ChatInterface geo={geo} />
      </ChatProvider>
    </HydrateClient>
  );
}
