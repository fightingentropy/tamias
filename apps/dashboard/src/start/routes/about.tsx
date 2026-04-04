import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/about")({
  loader: async () => {
    const { aboutSiteMetadata } = await import("@/site/pages/site-metadata");
    return aboutSiteMetadata;
  },
  head: ({ loaderData }) => buildHeadFromMetadata(loaderData),
});
