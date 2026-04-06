"use client";

import dynamic from "@/framework/dynamic";

const ExportStatus = dynamic(
  () => import("@/components/export-status").then((mod) => mod.ExportStatus),
  { ssr: false },
);

const GlobalSheetsProvider = dynamic(
  () =>
    import("@/components/sheets/global-sheets-provider").then((mod) => mod.GlobalSheetsProvider),
  { ssr: false },
);

const GlobalTimerProvider = dynamic(
  () => import("@/components/global-timer-provider").then((mod) => mod.GlobalTimerProvider),
  { ssr: false },
);

const TimezoneDetector = dynamic(
  () => import("@/components/timezone-detector").then((mod) => mod.TimezoneDetector),
  { ssr: false },
);

export function AppShellMachinery() {
  return (
    <>
      <ExportStatus />
      <GlobalSheetsProvider />
      <GlobalTimerProvider />
      <TimezoneDetector />
    </>
  );
}
