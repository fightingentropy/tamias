import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import {
  BankCoverageSitePage,
  bankCoverageSiteMetadata,
} from "@/site/pages/static-pages";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/bank-coverage")({
  head: () => buildHeadFromMetadata(bankCoverageSiteMetadata),
});
