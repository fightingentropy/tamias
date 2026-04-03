import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { policyMetadata } from "@/site/pages/legal/legal-metadata";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/policy")({
  head: () => buildHeadFromMetadata(policyMetadata),
});
