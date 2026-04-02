import { createFileRoute } from "@tanstack/react-router";
import { CompareSitePage, compareSiteMetadata } from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/compare/")({
  head: () => buildHeadFromMetadata(compareSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <CompareSitePage />
    </SiteLayoutShell>
  ),
});
