import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import {
  TimeTrackingSitePage,
  timeTrackingSiteMetadata,
} from "@/site/pages/static-pages";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/time-tracking")({
  head: () => buildHeadFromMetadata(timeTrackingSiteMetadata),
});
