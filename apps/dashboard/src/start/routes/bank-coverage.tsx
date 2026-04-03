import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { bankCoverageSiteMetadata } from "@/site/pages/bank-coverage-page";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/bank-coverage")({
  head: () => buildHeadFromMetadata(bankCoverageSiteMetadata),
});
