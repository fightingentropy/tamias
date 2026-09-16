"use client";

import { TZDate } from "@date-fns/tz";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/components/current-user-provider";
import { useWorkspaceActivity } from "@/hooks/use-workspace-activity";
import { MetricsFilter } from "@/components/metrics/components/metrics-filter";
import { Customize } from "@/components/widgets/customize";
import { SummaryTicker } from "./summary-ticker";
import { useIsCustomizing } from "./widget-provider";

function getTimeBasedGreeting(timezone?: string): string {
  const userTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = new TZDate(new Date(), userTimezone);
  const hour = now.getHours();

  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }
  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

export function WidgetsHeader() {
  const user = useCurrentUser();
  const isCustomizing = useIsCustomizing();
  const activity = useWorkspaceActivity();
  const [greeting, setGreeting] = useState(() => getTimeBasedGreeting(user?.timezone ?? undefined));

  useEffect(() => {
    setGreeting(getTimeBasedGreeting(user?.timezone ?? undefined));

    const interval = setInterval(
      () => {
        const newGreeting = getTimeBasedGreeting(user?.timezone ?? undefined);
        setGreeting(newGreeting);
      },
      5 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [user?.timezone]);

  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
      <div className="min-w-0">
        <p className="mb-2 text-sm text-muted-foreground">{user?.team?.name || "Your workspace"}</p>
        <h1 className="font-serif text-[28px] leading-tight sm:text-[32px]">
          {greeting}
          {user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}.
        </h1>
        {isCustomizing ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Drag and drop to arrange your dashboard.
          </p>
        ) : activity.isEmpty ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Let’s get your business records in place.
          </p>
        ) : (
          <SummaryTicker />
        )}
      </div>
      {(!activity.isEmpty || isCustomizing) && (
        <div className="flex items-center gap-2" data-no-close>
          <div className="hidden md:block">
            <Customize />
          </div>
          <MetricsFilter />
        </div>
      )}
    </div>
  );
}
