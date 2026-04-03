import { createLazyFileRoute } from "@tanstack/react-router";
import { InsightsSitePage } from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/insights")({
  component: InsightsPage,
});

function InsightsPage() {
  return (
    <SiteLayoutShell>
      <InsightsSitePage />
    </SiteLayoutShell>
  );
}
