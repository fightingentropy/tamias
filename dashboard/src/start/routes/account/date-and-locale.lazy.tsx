import { createLazyFileRoute } from "@tanstack/react-router";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { ChangeTimezone } from "@/components/change-timezone";
import { DateFormatSettings } from "@/components/date-format-settings";
import { LocaleSettings } from "@/components/locale-settings";
import { TimeFormatSettings } from "@/components/time-format-settings";
import { WeekSettings } from "@/components/week-settings";
import { loadAccountDateAndLocaleData } from "./date-and-locale";

export const Route = createLazyFileRoute("/account/date-and-locale")({
  component: AccountDateAndLocalePage,
});

function AccountDateAndLocalePage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadAccountDateAndLocaleData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <div className="space-y-12">
        <LocaleSettings />
        <ChangeTimezone />
        <TimeFormatSettings />
        <DateFormatSettings />
        <WeekSettings />
      </div>
    </AppLayoutShell>
  );
}
