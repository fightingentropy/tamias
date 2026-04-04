import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/mcp/claude")({
  loader: async () => {
    const { mcpClaudeSiteMetadata } = await import("@/site/pages/mcp-metadata");
    return mcpClaudeSiteMetadata;
  },
  head: ({ loaderData }) => buildHeadFromMetadata(loaderData),
});
