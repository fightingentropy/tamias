import {
  HydrationBoundary,
  type DehydratedState,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CurrentUserProvider, type CurrentUser } from "@/components/current-user-provider";
import { ExportStatus } from "@/components/export-status";
import { GlobalTimerProvider } from "@/components/global-timer-provider";
import { Header } from "@/components/header";
import { GlobalSheetsProvider } from "@/components/sheets/global-sheets-provider";
import { Sidebar } from "@/components/sidebar";
import { TimezoneDetector } from "@/components/timezone-detector";
import { TrialGuard } from "@/components/trial-guard";

export function AppLayoutShell(props: {
  dehydratedState: unknown;
  user: CurrentUser;
  children: ReactNode;
}) {
  return (
    <HydrationBoundary
      state={props.dehydratedState as DehydratedState | null | undefined}
    >
      <CurrentUserProvider initialUser={props.user}>
        <div className="relative">
          <Sidebar />

          <div className="md:ml-[70px] pb-4">
            <Header />
            <TrialGuard
              plan={props.user.team?.plan}
              createdAt={props.user.team?.createdAt}
            >
              <div className="px-4 md:px-8">{props.children}</div>
            </TrialGuard>
          </div>

          <ExportStatus />
          <GlobalSheetsProvider />
          <GlobalTimerProvider />
          <TimezoneDetector />
        </div>
      </CurrentUserProvider>
    </HydrationBoundary>
  );
}
