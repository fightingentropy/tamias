import { createLazyFileRoute } from "@tanstack/react-router";
import { TestimonialsSitePage } from "@/site/pages/testimonials-page";
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
