import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { insightsSiteMetadata } from "@/site/pages/insights-page";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/insights")({
  head: () => buildHeadFromMetadata(insightsSiteMetadata),
});
