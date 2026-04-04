import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/pre-accounting")({
  loader: async () => {
    const { preAccountingSiteMetadata } = await import("@/site/pages/site-metadata");
    return preAccountingSiteMetadata;
  },
  head: ({ loaderData }) => buildHeadFromMetadata(loaderData),
});
