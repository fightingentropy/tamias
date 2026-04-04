import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/time-tracking")({
  loader: async () => {
    const { timeTrackingSiteMetadata } = await import("@/site/pages/site-metadata");
    return timeTrackingSiteMetadata;
  },
  head: ({ loaderData }) => buildHeadFromMetadata(loaderData),
});
