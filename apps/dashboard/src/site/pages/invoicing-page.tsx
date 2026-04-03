import { Invoicing } from "@/site/components/invoicing";
import { createSiteMetadata } from "@/site/page-metadata";

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
