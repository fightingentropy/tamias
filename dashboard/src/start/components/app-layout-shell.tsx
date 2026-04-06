import "@/styles/globals.css";
import {
  HydrationBoundary,
  type DehydratedState,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CurrentUserProvider, type CurrentUser } from "@/components/current-user-provider";
import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { TrialGuard } from "@/components/trial-guard";
import { AppShellMachinery } from "@/start/components/app-shell-machinery";

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

          <AppShellMachinery />
        </div>
      </CurrentUserProvider>
    </HydrationBoundary>
  );
}
