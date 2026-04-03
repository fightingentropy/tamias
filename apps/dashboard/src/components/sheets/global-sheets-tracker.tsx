"use client";

import dynamic from "@/framework/dynamic";
import { TrackerCreateSheet } from "@/components/sheets/tracker-create-sheet";
import { TrackerScheduleSheet } from "@/components/sheets/tracker-schedule-sheet";
import { useTrackerParams } from "@/hooks/use-tracker-params";
import { useDeferredSheetMount } from "./global-sheet-mount";

const TrackerUpdateSheet = dynamic(
  () =>
    import("@/components/sheets/tracker-update-sheet").then(
      (mod) => mod.TrackerUpdateSheet,
    ),
  { ssr: false },
);

function TrackerUpdateSheetMount() {
  const { update, projectId } = useTrackerParams();
  const shouldMount = useDeferredSheetMount(update !== null && Boolean(projectId));

  return shouldMount ? <TrackerUpdateSheet /> : null;
}

export function GlobalTrackerSheets() {
  return (
    <>
      <TrackerUpdateSheetMount />
      <TrackerCreateSheet />
      <TrackerScheduleSheet />
    </>
  );
}
