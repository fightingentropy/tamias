import { createFileRoute } from "@tanstack/react-router";
import {
  PolicyPage,
  policyMetadata,
} from "@/site/pages/legal/policy-page";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/policy")({
  head: () => buildHeadFromMetadata(policyMetadata),
  component: () => (
    <SiteLayoutShell>
      <PolicyPage />
    </SiteLayoutShell>
  ),
});
