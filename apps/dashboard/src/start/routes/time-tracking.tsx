import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { timeTrackingSiteMetadata } from "@/site/pages/time-tracking-page";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/time-tracking")({
  head: () => buildHeadFromMetadata(timeTrackingSiteMetadata),
});
