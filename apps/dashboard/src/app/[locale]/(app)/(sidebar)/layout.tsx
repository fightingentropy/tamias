import { redirect } from "next/navigation";
import { CurrentUserProvider } from "@/components/current-user-provider";
import { ExportStatus } from "@/components/export-status";
import { GlobalTimerProvider } from "@/components/global-timer-provider";
import { Header } from "@/components/header";
import { GlobalSheetsProvider } from "@/components/sheets/global-sheets-provider";
import { Sidebar } from "@/components/sidebar";
import { TimezoneDetector } from "@/components/timezone-detector";
import { TrialGuard } from "@/components/trial-guard";
import {
  getCurrentTeamLocally,
  getCurrentUserLocally,
} from "@/server/loaders/identity";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();

  const [team, user] = await Promise.all([
    getCurrentTeamLocally(),
    getCurrentUserLocally().catch(() => redirect("/login")),
  ]);

  queryClient.setQueryData(trpc.team.current.queryKey(), team);
  queryClient.setQueryData(trpc.user.me.queryKey(), user);

  // Fetch the user – .catch → redirect so a transient API failure
  // (timeout, 5xx, expired session, etc.) doesn't crash the entire
  // layout and blank the page.
  if (!user) {
    redirect("/login");
  }

  if (!user.fullName || !user.teamId) {
    redirect("/onboarding");
  }

  return (
    <HydrateClient>
      <CurrentUserProvider initialUser={user}>
        <div className="relative">
          <Sidebar />

          <div className="md:ml-[70px] pb-4">
            <Header />
            <TrialGuard plan={user.team?.plan} createdAt={user.team?.createdAt}>
              <div className="px-4 md:px-8">{children}</div>
            </TrialGuard>
          </div>

          <ExportStatus />
          <GlobalSheetsProvider />
          <GlobalTimerProvider />
          <TimezoneDetector />
        </div>
      </CurrentUserProvider>
    </HydrateClient>
  );
}
