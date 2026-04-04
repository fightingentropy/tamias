import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/mcp/perplexity")({
  loader: async () => {
    const { mcpPerplexitySiteMetadata } = await import("@/site/pages/mcp-metadata");
    return mcpPerplexitySiteMetadata;
  },
  head: ({ loaderData }) => buildHeadFromMetadata(loaderData),
});
