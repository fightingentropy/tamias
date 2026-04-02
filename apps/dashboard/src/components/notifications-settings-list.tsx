import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@tamias/ui/card";
import { Suspense } from "react";
import { ErrorBoundary } from "./error-boundary";
import { ErrorFallback } from "./error-fallback";
import {
  NotificationSettings,
  NotificationSettingsSkeleton,
} from "./notification-settings";

export async function NotificationsSettingsList() {
  return (
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
  );
}
