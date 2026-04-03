import { createLazyFileRoute } from "@tanstack/react-router";
import { TestimonialsSitePage } from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/testimonials")({
  component: TestimonialsPage,
});

function TestimonialsPage() {
  return (
    <SiteLayoutShell>
      <TestimonialsSitePage />
    </SiteLayoutShell>
  );
}
