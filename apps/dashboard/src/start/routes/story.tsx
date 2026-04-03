import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { StorySitePage, storySiteMetadata } from "@/site/pages/static-pages";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/story")({
  head: () => buildHeadFromMetadata(storySiteMetadata),
});
