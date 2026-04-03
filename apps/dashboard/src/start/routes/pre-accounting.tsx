import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { preAccountingSiteMetadata } from "@/site/pages/pre-accounting-page";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/pre-accounting")({
  head: () => buildHeadFromMetadata(preAccountingSiteMetadata),
});
