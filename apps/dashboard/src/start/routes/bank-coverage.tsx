import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/bank-coverage")({
  loader: async () => {
    const { bankCoverageSiteMetadata } = await import("@/site/pages/site-metadata");
    return bankCoverageSiteMetadata;
  },
  head: ({ loaderData }) => buildHeadFromMetadata(loaderData),
});
