import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/mcp/n8n")({
  loader: async () => {
    const { mcpN8nSiteMetadata } = await import("@/site/pages/mcp-metadata");
    return mcpN8nSiteMetadata;
  },
  head: ({ loaderData }) => buildHeadFromMetadata(loaderData),
});
