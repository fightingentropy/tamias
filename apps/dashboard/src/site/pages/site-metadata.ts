import { createSiteMetadata } from "@/site/page-metadata";

const compareYear = new Date().getFullYear();

export const aboutSiteMetadata = createSiteMetadata({
  title: "About",
  description:
    "About Tamias. Learn more about the team and company behind your AI-powered business assistant.",
  path: "/about",
});

export const assistantSiteMetadata = createSiteMetadata({
  title: "AI Assistant",
  description:
    "Your AI-powered business assistant. Ask questions about your business and get clear, actionable answers based on your real business data.",
  path: "/assistant",
});

export const bankCoverageSiteMetadata = createSiteMetadata({
  title: "Bank Coverage",
  description:
    "We currently support over 25,000+ banks worldwide. Search to find your bank and connect your accounts to Tamias.",
  path: "/bank-coverage",
});

export const compareSiteMetadata = createSiteMetadata({
  title: `Compare Tamias to QuickBooks, Xero, FreshBooks & More (${compareYear})`,
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

export const customersSiteMetadata = createSiteMetadata({
  title: "Customer Management",
  description:
    "Know your customers better. Track customer performance, payment history, and outstanding invoices all in one place.",
  path: "/customers",
});

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

export const integrationsSiteMetadata = createSiteMetadata({
  title: "Integrations",
  description:
    "Connect Tamias with your favorite tools. Explore integrations for email, accounting, productivity, and more.",
  path: "/integrations",
});

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

export const storySiteMetadata = createSiteMetadata({
  title: "Story",
  description:
    "Why we built Tamias. Learn about our mission to help one-person companies stay on top of their business finances without the manual work.",
  path: "/story",
});

export const supportSiteMetadata = createSiteMetadata({
  title: "Support",
  description:
    "Get help with Tamias. Contact our team for assistance with any questions or issues you may have.",
  path: "/support",
});

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
