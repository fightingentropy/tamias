import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { termsMetadata } from "@/site/pages/legal/legal-metadata";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/terms")({
  head: () => buildHeadFromMetadata(termsMetadata),
});
