import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/mcp/cursor")({
  loader: async () => {
    const { mcpCursorSiteMetadata } = await import("@/site/pages/mcp-metadata");
    return mcpCursorSiteMetadata;
  },
  head: ({ loaderData }) => buildHeadFromMetadata(loaderData),
});
