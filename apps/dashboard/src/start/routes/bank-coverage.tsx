import { createFileRoute } from "@tanstack/react-router";
import {
  BankCoverageSitePage,
  bankCoverageSiteMetadata,
} from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/bank-coverage")({
  head: () => buildHeadFromMetadata(bankCoverageSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <BankCoverageSitePage />
    </SiteLayoutShell>
  ),
});
