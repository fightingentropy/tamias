import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { storySiteMetadata } from "@/site/pages/site-metadata";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/story")({
  head: () => buildHeadFromMetadata(storySiteMetadata),
});
