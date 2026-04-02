import { createFileRoute } from "@tanstack/react-router";
import {
  AssistantSitePage,
  assistantSiteMetadata,
} from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/assistant")({
  head: () => buildHeadFromMetadata(assistantSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <AssistantSitePage />
    </SiteLayoutShell>
  ),
});
