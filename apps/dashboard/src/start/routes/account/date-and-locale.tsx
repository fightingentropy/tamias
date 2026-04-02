import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { ChangeTimezone } from "@/components/change-timezone";
import { DateFormatSettings } from "@/components/date-format-settings";
import { LocaleSettings } from "@/components/locale-settings";
import { TimeFormatSettings } from "@/components/time-format-settings";
import { WeekSettings } from "@/components/week-settings";

const loadAccountDateAndLocaleData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildAccountDateAndLocalePageData } = await import(
      "@/start/server/route-data"
    );
    return (await buildAccountDateAndLocalePageData()) as any;
  },
);

export const Route = createFileRoute("/account/date-and-locale")({
  loader: () => loadAccountDateAndLocaleData(),
  head: () => ({
    meta: [{ title: "Date & Locale | Tamias" }],
  }),
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
