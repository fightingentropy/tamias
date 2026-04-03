import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { TermsPage, termsMetadata } from "@/site/pages/legal/terms-page";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/terms")({
  head: () => buildHeadFromMetadata(termsMetadata),
});
