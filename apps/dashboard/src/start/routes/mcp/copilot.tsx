import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/mcp/copilot")({
  loader: async () => {
    const { mcpCopilotSiteMetadata } = await import("@/site/pages/mcp-metadata");
    return mcpCopilotSiteMetadata;
  },
  head: ({ loaderData }) => buildHeadFromMetadata(loaderData),
});
