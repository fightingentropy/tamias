import { createFileRoute } from "@tanstack/react-router";
import {
  IntegrationsSitePage,
  integrationsSiteMetadata,
} from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/integrations/")({
  head: () => buildHeadFromMetadata(integrationsSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <IntegrationsSitePage />
    </SiteLayoutShell>
  ),
});
