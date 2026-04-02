import { createFileRoute } from "@tanstack/react-router";
import {
  PreAccountingSitePage,
  preAccountingSiteMetadata,
} from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/pre-accounting")({
  head: () => buildHeadFromMetadata(preAccountingSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <PreAccountingSitePage />
    </SiteLayoutShell>
  ),
});
