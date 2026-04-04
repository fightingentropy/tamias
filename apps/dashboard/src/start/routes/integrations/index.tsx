import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/integrations/")({
  loader: async () => {
    const { integrationsSiteMetadata } = await import("@/site/pages/site-metadata");
    return integrationsSiteMetadata;
  },
  head: ({ loaderData }) => buildHeadFromMetadata(loaderData),
});
