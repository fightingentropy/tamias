import { createLazyFileRoute } from "@tanstack/react-router";
import { Pricing } from "@/site/components/pricing";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Tamias",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, macOS",
  description:
    "Business finance software for invoicing, expense tracking, time tracking, and financial insights.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free plan available",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5",
    ratingCount: "100",
  },
};

export const Route = createLazyFileRoute("/pricing")({
  component: PricingPage,
});

function PricingPage() {
  return (
    <SiteLayoutShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Pricing />
    </SiteLayoutShell>
  );
}
