"use client";

import { TZDate } from "@date-fns/tz";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/components/current-user-provider";
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
    <div className="mb-8">
      <div className="flex justify-between items-start mb-6">
        <div />
        <div className="flex items-center gap-2" data-no-close>
          <div className="hidden md:block">
            <Customize />
          </div>
          <MetricsFilter />
        </div>
      </div>

      {!isCustomizing && (
        <div className="text-center mt-16 mb-10">
          <h1 className="text-[30px] font-serif leading-normal">
            {greeting}, {user?.fullName?.split(" ")[0]}.
          </h1>
          <SummaryTicker />
        </div>
      )}

      {isCustomizing && (
        <div className="text-center mt-8 mb-6">
          <h1 className="text-[30px] font-serif leading-normal mb-1">
            {greeting}, {user?.fullName?.split(" ")[0]}.
          </h1>
          <p className="text-[#666666] text-[14px]">
            Drag and drop to arrange your perfect dashboard.
          </p>
        </div>
      )}
    </div>
  );
}
