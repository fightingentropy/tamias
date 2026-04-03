import { createLazyFileRoute } from "@tanstack/react-router";
import { ComparisonPage } from "@/site/components/comparison-page";
import { getCompetitorBySlug } from "@/site/data/competitors";
import { SiteNotFoundPage } from "@/start/components/site-not-found-page";
import { JsonLdScript } from "@/start/site-head";
import { baseUrl } from "@/site/base-url";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/compare/$slug")({
  component: CompareDetailPage,
});

function CompareDetailPage() {
  const { slug } = Route.useParams();
  const competitor = getCompetitorBySlug(slug);

  if (!competitor) {
    return <SiteNotFoundPage />;
  }

  const year = new Date().getFullYear();
  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `Best ${competitor.name} Alternative for Founders (${year})`,
    description: `Looking for a ${competitor.name} alternative? Switch to Tamias - built for founders, not accountants.`,
    url: `${baseUrl}/compare/${slug}`,
    mainEntity: {
      "@type": "SoftwareApplication",
      name: "Tamias",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, macOS",
      description:
        "Business finance software for invoicing, expense tracking, time tracking, and financial insights. Built for founders, not accountants.",
      offers: {
        "@type": "Offer",
        price: "23",
        priceCurrency: "USD",
        description:
          "Starting at $23/month billed yearly with 14-day free trial",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "5",
        ratingCount: "100",
      },
    },
    about: {
      "@type": "SoftwareApplication",
      name: competitor.name,
      applicationCategory: "BusinessApplication",
    },
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: competitor.faq.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };

  return (
    <SiteLayoutShell>
      <JsonLdScript value={webPageJsonLd} />
      <JsonLdScript value={faqJsonLd} />
      <ComparisonPage competitor={competitor} />
    </SiteLayoutShell>
  );
}
