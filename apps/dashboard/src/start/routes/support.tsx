import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { supportSiteMetadata } from "@/site/pages/support-page";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/support")({
  head: () => buildHeadFromMetadata(supportSiteMetadata),
});
