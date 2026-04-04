import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/assistant")({
  loader: async () => {
    const { assistantSiteMetadata } = await import("@/site/pages/site-metadata");
    return assistantSiteMetadata;
  },
  head: ({ loaderData }) => buildHeadFromMetadata(loaderData),
});
