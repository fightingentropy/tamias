import { createFileRoute } from "@tanstack/react-router";
import { StorySitePage, storySiteMetadata } from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/story")({
  head: () => buildHeadFromMetadata(storySiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <StorySitePage />
    </SiteLayoutShell>
  ),
});
