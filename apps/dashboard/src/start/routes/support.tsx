import { createFileRoute } from "@tanstack/react-router";
import {
  SupportSitePage,
  supportSiteMetadata,
} from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/support")({
  head: () => buildHeadFromMetadata(supportSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <SupportSitePage />
    </SiteLayoutShell>
  ),
});
