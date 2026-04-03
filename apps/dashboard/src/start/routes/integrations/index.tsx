import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { integrationsSiteMetadata } from "@/site/pages/integrations-page";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/integrations/")({
  head: () => buildHeadFromMetadata(integrationsSiteMetadata),
});
