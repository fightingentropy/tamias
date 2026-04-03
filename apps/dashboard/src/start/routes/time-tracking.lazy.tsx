import { createLazyFileRoute } from "@tanstack/react-router";
import { TimeTrackingSitePage } from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/time-tracking")({
  component: TimeTrackingPage,
});

function TimeTrackingPage() {
  return (
    <SiteLayoutShell>
      <TimeTrackingSitePage />
    </SiteLayoutShell>
  );
}
