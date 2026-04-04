import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/mcp/")({
  loader: async () => {
    const { mcpSiteMetadata } = await import("@/site/pages/mcp-metadata");
    return mcpSiteMetadata;
  },
  head: ({ loaderData }) => buildHeadFromMetadata(loaderData),
});
