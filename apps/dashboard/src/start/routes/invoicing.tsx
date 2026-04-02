import { createFileRoute } from "@tanstack/react-router";
import {
  InvoicingSitePage,
  invoicingSiteMetadata,
} from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/invoicing")({
  head: () => buildHeadFromMetadata(invoicingSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <InvoicingSitePage />
    </SiteLayoutShell>
  ),
});
