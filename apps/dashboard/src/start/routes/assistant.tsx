import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { assistantSiteMetadata } from "@/site/pages/assistant-page";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/assistant")({
  head: () => buildHeadFromMetadata(assistantSiteMetadata),
});
