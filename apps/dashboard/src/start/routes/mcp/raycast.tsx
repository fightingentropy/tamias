import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/mcp/raycast")({
  loader: async () => {
    const { mcpRaycastSiteMetadata } = await import("@/site/pages/mcp-metadata");
    return mcpRaycastSiteMetadata;
  },
  head: ({ loaderData }) => buildHeadFromMetadata(loaderData),
});
