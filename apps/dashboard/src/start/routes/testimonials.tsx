import { createFileRoute } from "@tanstack/react-router";
import {
  TestimonialsSitePage,
  testimonialsSiteMetadata,
} from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/testimonials")({
  head: () => buildHeadFromMetadata(testimonialsSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <TestimonialsSitePage />
    </SiteLayoutShell>
  ),
});
