import { createFileRoute } from "@tanstack/react-router";
import { Pricing } from "@/site/components/pricing";
import { SiteLayoutShell } from "@/start/root-shell";
import { baseUrl } from "@/site/sitemap";

const title = "Pricing";
const description =
  "Simple, transparent pricing for Tamias. Start free and upgrade as you grow. Invoicing, expense tracking, and financial tools for small business owners.";

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

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: `${baseUrl}/pricing` },
    ],
  }),
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
