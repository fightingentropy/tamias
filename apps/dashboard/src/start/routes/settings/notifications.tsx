import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@tamias/ui/card";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Suspense } from "react";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorFallback } from "@/components/error-fallback";
import {
  NotificationSettings,
  NotificationSettingsSkeleton,
} from "@/components/notification-settings";

const loadSettingsNotificationsData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildSettingsNotificationsPageData } = await import(
      "@/start/server/route-data"
    );
    return (await buildSettingsNotificationsPageData()) as any;
  },
);

export const Route = createFileRoute("/settings/notifications")({
  loader: () => loadSettingsNotificationsData(),
  head: () => ({
    meta: [{ title: "Notifications | Tamias" }],
  }),
  component: SettingsNotificationsPage,
});

function SettingsNotificationsPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadSettingsNotificationsData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Manage your personal notification settings for this team.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <ErrorBoundary errorComponent={ErrorFallback}>
            <Suspense fallback={<NotificationSettingsSkeleton />}>
              <NotificationSettings />
            </Suspense>
          </ErrorBoundary>
        </CardContent>
      </Card>
    </AppLayoutShell>
  );
}
