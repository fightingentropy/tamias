import { createFileRoute } from "@tanstack/react-router";
import { ComparisonPage } from "@/site/components/comparison-page";
import {
  getCompetitorBySlug,
} from "@/site/data/competitors";
import { SiteNotFoundPage } from "@/start/components/site-not-found-page";
import { baseUrl } from "@/site/sitemap";
import { SiteLayoutShell } from "@/start/root-shell";
import { JsonLdScript } from "@/start/site-head";

export const Route = createFileRoute("/compare/$slug")({
  head: ({ params }) => {
    const competitor = getCompetitorBySlug(params.slug);

    if (!competitor) {
      return {
        meta: [
          { title: "Page not found" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }

    const year = new Date().getFullYear();
    const title = `Best ${competitor.name} Alternative for Founders (${year}) | Tamias`;
    const description = `Looking for a ${competitor.name} alternative? Switch to Tamias - built for founders, not accountants. Compare features, pricing, and see why teams are making the switch. Free trial available.`;
    const image = `${baseUrl}/api/og/compare?name=${encodeURIComponent(competitor.name)}`;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        {
          name: "keywords",
          content: [
            `${competitor.name.toLowerCase()} alternative`,
            `${competitor.name.toLowerCase()} alternative ${year}`,
            `${competitor.name.toLowerCase()} vs tamias`,
            `switch from ${competitor.name.toLowerCase()}`,
            `${competitor.name.toLowerCase()} pricing`,
            `${competitor.name.toLowerCase()} competitor`,
            "business finance software",
            "invoicing software for founders",
            "expense tracking",
            "time tracking software",
            "founder tools",
            "small business software",
          ].join(", "),
        },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${baseUrl}/compare/${params.slug}` },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
      links: [
        {
          rel: "canonical",
          href: `${baseUrl}/compare/${params.slug}`,
        },
      ],
    };
  },
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
