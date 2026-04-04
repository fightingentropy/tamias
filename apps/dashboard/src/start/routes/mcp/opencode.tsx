import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/mcp/opencode")({
  loader: async () => {
    const { mcpOpenCodeSiteMetadata } = await import("@/site/pages/mcp-metadata");
    return mcpOpenCodeSiteMetadata;
  },
  head: ({ loaderData }) => buildHeadFromMetadata(loaderData),
});
