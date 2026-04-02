import { createFileRoute } from "@tanstack/react-router";
import { AboutSitePage, aboutSiteMetadata } from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/about")({
  head: () => buildHeadFromMetadata(aboutSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <AboutSitePage />
    </SiteLayoutShell>
  ),
});
