import { Button } from "@tamias/ui/button";
import Image from "@/framework/image";
import Link from "@/framework/link";
import { Assistant } from "@/site/components/assistant";
import { BankCoverage } from "@/site/components/bank-coverage";
import { Customers } from "@/site/components/customers";
import { FileStorage } from "@/site/components/file-storage";
import { Inbox } from "@/site/components/inbox";
import { Insights } from "@/site/components/insights";
import { IntegrationsGrid } from "@/site/components/integrations-grid";
import { Invoicing } from "@/site/components/invoicing";
import { PreAccounting } from "@/site/components/pre-accounting";
import { SupportForm } from "@/site/components/support-form";
import { Testimonials } from "@/site/components/testimonials";
import { TimeTracking } from "@/site/components/time-tracking";
import { Transactions } from "@/site/components/transactions";
import { apps } from "@/site/data/apps";
import { competitors } from "@/site/data/competitors";
import { createSiteMetadata } from "@/site/page-metadata";

const year = new Date().getFullYear();
export const aboutSiteMetadata = createSiteMetadata({
  title: "About",
  description:
    "About Tamias. Learn more about the team and company behind your AI-powered business assistant.",
  path: "/about",
});

export function AboutSitePage() {
  return <div>AboutPage</div>;
}

export const assistantSiteMetadata = createSiteMetadata({
  title: "AI Assistant",
  description:
    "Your AI-powered business assistant. Ask questions about your business and get clear, actionable answers based on your real business data.",
  path: "/assistant",
});

export function AssistantSitePage() {
  return <Assistant />;
}

export const bankCoverageSiteMetadata = createSiteMetadata({
  title: "Bank Coverage",
  description:
    "We currently support over 25,000+ banks worldwide. Search to find your bank and connect your accounts to Tamias.",
  path: "/bank-coverage",
});

export function BankCoverageSitePage() {
  return <BankCoverage />;
}

export const compareSiteMetadata = createSiteMetadata({
  title: `Compare Tamias to QuickBooks, Xero, FreshBooks & More (${year})`,
  description:
    "Looking for QuickBooks, Xero, or FreshBooks alternatives? Compare Tamias to popular accounting and finance tools. Built for founders, not accountants. Free 14-day trial.",
  path: "/compare",
  keywords: [
    "quickbooks alternative",
    "xero alternative",
    "freshbooks alternative",
    "accounting software comparison",
    "business finance software",
    "invoicing software for founders",
    "small business tools",
  ],
  image: "https://tamias.xyz/api/og/compare",
  imageAlt: "Compare Tamias to alternatives",
});

export function CompareSitePage() {
  return (
    <div className="min-h-screen pt-24 sm:pt-28 lg:pt-32 pb-24">
      <div className="max-w-[1400px] mx-auto">
        <div className="text-center mb-12 lg:mb-16">
          <h1 className="font-serif text-3xl lg:text-4xl text-foreground mb-4">
            Compare Tamias to alternatives
          </h1>
          <p className="font-sans text-base text-muted-foreground max-w-2xl mx-auto">
            Tamias is built for founders and small teams who want clarity
            over their finances without the complexity of traditional accounting
            software.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {competitors.map((competitor) => (
            <Link
              key={competitor.id}
              href={`/compare/${competitor.slug}`}
              className="border border-border p-6 hover:border-foreground/20 transition-all duration-200"
            >
              <h2 className="font-sans text-lg text-foreground mb-2">
                {competitor.name} Alternative
              </h2>
              <p className="font-sans text-sm text-muted-foreground mb-4 line-clamp-2">
                {competitor.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {competitor.keyDifferences.slice(0, 2).map((difference) => (
                  <span
                    key={difference.title}
                    className="font-sans text-xs text-muted-foreground bg-muted px-2 py-1"
                  >
                    {difference.tamias}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>

        <div className="bg-background border border-border p-8 lg:p-12 text-center relative before:absolute before:inset-0 before:bg-[repeating-linear-gradient(-60deg,rgba(219,219,219,0.4),rgba(219,219,219,0.4)_1px,transparent_1px,transparent_6px)] dark:before:bg-[repeating-linear-gradient(-60deg,rgba(44,44,44,0.4),rgba(44,44,44,0.4)_1px,transparent_1px,transparent_6px)] before:pointer-events-none">
          <div className="relative z-10">
            <h2 className="font-serif text-2xl text-foreground mb-4">
              Ready to try Tamias?
            </h2>
            <p className="font-sans text-base text-muted-foreground mb-6 max-w-xl mx-auto">
              Start your 14-day free trial and see why founders are switching to
              Tamias.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="btn-inverse h-11 px-6">
                <Link href="/login">Start your free trial</Link>
              </Button>
              <Button asChild variant="outline" className="h-11 px-6">
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const customersSiteMetadata = createSiteMetadata({
  title: "Customer Management",
  description:
    "Know your customers better. Track customer performance, payment history, and outstanding invoices all in one place.",
  path: "/customers",
});

export function CustomersSitePage() {
  return <Customers />;
}

export const fileStorageSiteMetadata = createSiteMetadata({
  title: "Document Vault",
  description:
    "Store and organize all your business documents in one secure place. Access receipts, contracts, invoices, and files anytime. Built for small business owners.",
  path: "/file-storage",
  keywords: [
    "document storage",
    "business file storage",
    "secure document vault",
    "receipt storage",
    "contract management",
  ],
});

export function FileStorageSitePage() {
  return <FileStorage />;
}

export const inboxSiteMetadata = createSiteMetadata({
  title: "Receipt Inbox",
  description:
    "Capture receipts and invoices automatically. Match documents to transactions, search your records, and stay organized. Built for small business owners.",
  path: "/inbox",
  keywords: [
    "receipt management",
    "receipt scanner",
    "invoice management",
    "document management",
    "expense receipts",
  ],
});

export function InboxSitePage() {
  return <Inbox />;
}

export const insightsSiteMetadata = createSiteMetadata({
  title: "Business Insights",
  description:
    "Understand your business at a glance. Get weekly summaries, cash flow analysis, and clear explanations of revenue and spending trends.",
  path: "/insights",
  keywords: [
    "business insights",
    "business analytics",
    "cash flow analysis",
    "revenue tracking",
    "spending analysis",
  ],
});

export function InsightsSitePage() {
  return <Insights />;
}

export const integrationsSiteMetadata = createSiteMetadata({
  title: "Integrations",
  description:
    "Connect Tamias with your favorite tools. Explore integrations for email, accounting, productivity, and more.",
  path: "/integrations",
});

export function IntegrationsSitePage() {
  return <IntegrationsGrid apps={apps} activeCategory="all" />;
}

export const invoicingSiteMetadata = createSiteMetadata({
  title: "Invoicing",
  description:
    "Create professional invoices in seconds. Track payments, send reminders, and get paid faster with invoicing software built for small business owners.",
  path: "/invoicing",
  keywords: [
    "invoice software",
    "small business invoicing",
    "online invoicing",
    "invoice generator",
    "billing software",
  ],
});

export function InvoicingSitePage() {
  return <Invoicing />;
}

export const preAccountingSiteMetadata = createSiteMetadata({
  title: "Pre-Accounting",
  description:
    "Automated bookkeeping that collects transactions, matches receipts, and prepares accountant-ready records. Save hours on manual data entry every month.",
  path: "/pre-accounting",
  keywords: [
    "bookkeeping software",
    "small business bookkeeping",
    "automated bookkeeping",
    "pre-accounting",
    "accountant-ready records",
  ],
});

export function PreAccountingSitePage() {
  return <PreAccounting />;
}

export const storySiteMetadata = createSiteMetadata({
  title: "Story",
  description:
    "Why we built Tamias. Learn about our mission to help one-person companies stay on top of their business finances without the manual work.",
  path: "/story",
});

export function StorySitePage() {
  return (
    <div className="min-h-screen">
      <div className="pt-32 pb-16 sm:pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-12">
            <div className="space-y-4 text-center">
              <h1 className="font-serif text-3xl lg:text-3xl xl:text-3xl 2xl:text-3xl 3xl:text-4xl leading-tight lg:leading-tight xl:leading-[1.3] text-foreground">
                Why we started Tamias
              </h1>
            </div>

            <div className="prose prose-sm sm:prose-base max-w-none space-y-8 font-sans text-foreground">
              <section className="space-y-4">
                <h2 className="font-sans text-base text-foreground">
                  The problem
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Running a company used to mean building a team. Today, more
                  companies are run by one person.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  AI, automation and the internet make it possible to design,
                  sell, deliver and operate a real business alone. These are
                  one-person companies, and they are becoming more common every
                  year. But the software world has not caught up.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Most business tools still assume you have a team. Time
                  tracking lives in one place. Invoices in another. Receipts end
                  up across inboxes and folders. Transactions sit inside bank
                  dashboards. To understand how your company is doing, you often
                  have to jump between tools, reconcile numbers manually and
                  piece the story together yourself.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  For someone running a company alone, that overhead adds up
                  quickly. You are not lacking information. You are lacking a
                  system that keeps everything connected.
                </p>
              </section>

              <div className="flex items-center justify-center py-8">
                <div className="h-px w-full max-w-xs border-t border-border" />
              </div>

              <section className="space-y-4">
                <h2 className="font-sans text-base text-foreground">
                  The idea
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  We did not want to build another finance tool. We wanted to
                  build a system where everything stays connected without you
                  having to hold it together.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Tamias keeps the moving parts of your business connected as
                  things change, without you constantly checking dashboards or
                  digging through reports. Invoices, receipts, transactions,
                  time and documents should not live in silos. They should
                  reinforce each other and reflect what is actually happening in
                  your business.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Instead of pulling information out of the system, Tamias
                  pushes the right information to you. Clear summaries,
                  notifications and signals help you understand what has
                  changed, what needs attention and what is on track. This way
                  you stay informed without living inside admin software.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Tamias does not replace your accountant. It sits in between
                  and keeps everything organized and ready so conversations are
                  easier and decisions are based on up to date information.
                </p>
              </section>

              <div className="flex items-center justify-center py-8">
                <div className="h-px w-full max-w-xs border-t border-border" />
              </div>

              <section className="space-y-4">
                <h2 className="font-sans text-base text-foreground">
                  What we are focused on
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  Tamias is built for founders who run real businesses
                  without building large teams and who want to stay on top of
                  their company without spending their time managing admin.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  We focus on reducing manual and repetitive work, keeping
                  business data consistent and reliable, surfacing the right
                  information at the right time, and making it easy to
                  understand what is happening and why. Most importantly, we
                  build software that works quietly in the background.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Our goal is simple. When you run the whole company yourself,
                  you should not have to spend your time managing admin.
                </p>
                <p className="text-muted-foreground leading-relaxed font-medium">
                  Your business should stay organized and explain itself as it
                  runs.
                </p>
              </section>
            </div>

            <div className="w-full space-y-3">
              <Image
                src="/founders.png"
                alt="Founders"
                width={1200}
                height={450}
                className="w-full h-[350px] sm:h-[450px] object-cover object-center"
                priority
              />
              <div className="text-left">
                <p className="font-sans text-sm text-primary">
                  Pontus & Viktor
                </p>
                <p className="font-sans text-sm text-muted-foreground">
                  Founders, Tamias
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const supportSiteMetadata = createSiteMetadata({
  title: "Support",
  description:
    "Get help with Tamias. Contact our team for assistance with any questions or issues you may have.",
  path: "/support",
});

export function SupportSitePage() {
  return <SupportForm />;
}

export const testimonialsSiteMetadata = createSiteMetadata({
  title: "Customer Stories",
  description:
    "See how solo founders use Tamias to run their businesses with less admin.",
  path: "/testimonials",
  keywords: [
    "customer testimonials",
    "user stories",
    "tamias reviews",
    "customer success",
    "testimonials",
  ],
});

export function TestimonialsSitePage() {
  return <Testimonials />;
}

export const timeTrackingSiteMetadata = createSiteMetadata({
  title: "Time Tracking",
  description:
    "Track billable hours with ease. Get monthly breakdowns, link time to projects and customers, and generate invoices. Built for consultants and small business owners.",
  path: "/time-tracking",
  keywords: [
    "time tracking",
    "billable hours",
    "time tracker",
    "project time tracking",
    "small business time management",
  ],
});

export function TimeTrackingSitePage() {
  return <TimeTracking />;
}

export const transactionsSiteMetadata = createSiteMetadata({
  title: "Transactions",
  description:
    "Track all your business expenses in one place. Automatically sync and categorize transactions from your bank accounts. Built for small business owners.",
  path: "/transactions",
  keywords: [
    "expense tracking",
    "business expenses",
    "transaction management",
    "expense categorization",
    "small business accounting",
  ],
});

export function TransactionsSitePage() {
  return <Transactions />;
}
