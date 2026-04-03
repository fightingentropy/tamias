import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import {
  IntegrationsSitePage,
  integrationsSiteMetadata,
} from "@/site/pages/static-pages";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/integrations/")({
  head: () => buildHeadFromMetadata(integrationsSiteMetadata),
});
