import { createFileRoute } from "@tanstack/react-router";
import { TermsPage, termsMetadata } from "@/site/pages/legal/terms-page";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/terms")({
  head: () => buildHeadFromMetadata(termsMetadata),
  component: () => (
    <SiteLayoutShell>
      <TermsPage />
    </SiteLayoutShell>
  ),
});
