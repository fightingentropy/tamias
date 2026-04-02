import { createFileRoute } from "@tanstack/react-router";
import { DocsHomeHero } from "@/site/components/docs/docs-home-hero";
import Link from "@/framework/link";
import { SiteLayoutShell } from "@/start/root-shell";
import { baseUrl } from "@/site/sitemap";

const title = "Documentation";
const description =
  "Learn how to use Tamias to run your business. Get answers about invoicing, banking, time tracking, reports, and more.";

const popularGuides = [
  {
    title: "Getting Started",
    href: "/docs/introduction",
    description: "What is Tamias and how it helps you",
  },
  {
    title: "Quick Start",
    href: "/docs/quick-start",
    description: "Get running in 5 minutes",
  },
  {
    title: "Create Invoice",
    href: "/docs/create-invoice",
    description: "Send professional invoices",
  },
  {
    title: "Connect Bank",
    href: "/docs/connect-bank-account",
    description: "Link your accounts",
  },
  {
    title: "Receipt Matching",
    href: "/docs/receipt-matching",
    description: "AI-powered matching",
  },
  {
    title: "Understanding Metrics",
    href: "/docs/understanding-metrics",
    description: "How your numbers work",
  },
];

const sections = [
  {
    title: "Getting Started",
    links: [
      { title: "Introduction", href: "/docs/introduction" },
      { title: "Quick Start", href: "/docs/quick-start" },
      { title: "Troubleshooting", href: "/docs/troubleshooting" },
    ],
  },
  {
    title: "Banking",
    links: [
      { title: "Connect Bank", href: "/docs/connect-bank-account" },
      { title: "Categorization", href: "/docs/auto-categorization" },
      { title: "Multi-Currency", href: "/docs/multi-currency" },
      { title: "Categories Reference", href: "/docs/categories-reference" },
    ],
  },
  {
    title: "Inbox & Vault",
    links: [
      { title: "Receipt Matching", href: "/docs/receipt-matching" },
      { title: "Connect Gmail", href: "/docs/connect-gmail" },
      { title: "Connect Slack", href: "/docs/connect-slack" },
      { title: "File Storage", href: "/docs/vault-file-storage" },
    ],
  },
];

export const Route = createFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: `${baseUrl}/docs` },
    ],
  }),
  component: DocsPage,
});

function DocsPage() {
  return (
    <SiteLayoutShell>
      <div className="min-h-[calc(100vh-200px)] pb-32 md:pb-24">
        <DocsHomeHero />

        <div className="max-w-4xl mx-auto px-4 mb-16">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6">
            Popular guides
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border">
            {popularGuides.map((guide) => (
              <Link
                key={guide.href}
                href={guide.href}
                className="group bg-background p-5 hover:bg-secondary/30 transition-colors"
              >
                <span className="block text-sm font-medium text-foreground mb-1">
                  {guide.title}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {guide.description}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6">
            Browse by topic
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {sections.map((section) => (
              <div key={section.title}>
                <h3 className="text-sm font-medium text-foreground mb-3">
                  {section.title}
                </h3>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SiteLayoutShell>
  );
}
