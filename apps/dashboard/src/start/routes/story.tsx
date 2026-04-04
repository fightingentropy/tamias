import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/story")({
  loader: async () => {
    const { storySiteMetadata } = await import("@/site/pages/site-metadata");
    return storySiteMetadata;
  },
  head: ({ loaderData }) => buildHeadFromMetadata(loaderData),
});
