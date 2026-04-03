import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { compareSiteMetadata } from "@/site/pages/static-pages";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/compare/")({
  head: () => buildHeadFromMetadata(compareSiteMetadata),
});
