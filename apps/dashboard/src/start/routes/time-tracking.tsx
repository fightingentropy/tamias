import { createFileRoute } from "@tanstack/react-router";
import {
  TimeTrackingSitePage,
  timeTrackingSiteMetadata,
} from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/time-tracking")({
  head: () => buildHeadFromMetadata(timeTrackingSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <TimeTrackingSitePage />
    </SiteLayoutShell>
  ),
});
