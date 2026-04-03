import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { aboutSiteMetadata } from "@/site/pages/about-page";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/about")({
  head: () => buildHeadFromMetadata(aboutSiteMetadata),
});
