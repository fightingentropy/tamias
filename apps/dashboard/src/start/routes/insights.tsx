import { createFileRoute } from "@tanstack/react-router";
import {
  InsightsSitePage,
  insightsSiteMetadata,
} from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/insights")({
  head: () => buildHeadFromMetadata(insightsSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <InsightsSitePage />
    </SiteLayoutShell>
  ),
});
