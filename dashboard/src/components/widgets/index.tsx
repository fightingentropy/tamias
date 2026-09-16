"use client";

import type { AppRouter } from "@tamias/trpc";
import { cn } from "@tamias/ui/cn";
import type { inferRouterOutputs } from "@trpc/server";
import { useChatInterface } from "@/hooks/use-chat-interface";
import { useInsightFromUrl } from "@/hooks/use-insight-from-url";
import { WidgetsHeader } from "./header";
import { OverviewMetricGrid } from "./overview-metric-grid";
import { OverviewWidgetDataProvider } from "./overview-widget-data";
import { useIsCustomizing, WidgetProvider } from "./widget-provider";
import { WidgetsGrid } from "./widgets-grid";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type WidgetPreferences = RouterOutputs["widgets"]["getWidgetPreferences"];

function WidgetsContent() {
  const { isChatPage, isHome } = useChatInterface();
  const isCustomizing = useIsCustomizing();

  // Handle ?insight= query parameter from email links
  useInsightFromUrl();

  if (isChatPage) {
    return null;
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[1120px] flex-col mt-8",
        isHome && "widgets-container-spacing",
      )}
    >
      <WidgetsHeader />
      {isCustomizing ? (
        <OverviewWidgetDataProvider>
          <WidgetsGrid />
        </OverviewWidgetDataProvider>
      ) : (
        <OverviewWidgetDataProvider>
          <OverviewMetricGrid />
        </OverviewWidgetDataProvider>
      )}
    </div>
  );
}

interface WidgetsProps {
  initialPreferences: WidgetPreferences | null;
}

export function Widgets({ initialPreferences }: WidgetsProps) {
  return (
    <WidgetProvider initialPreferences={initialPreferences ?? undefined}>
      <WidgetsContent />
    </WidgetProvider>
  );
}
