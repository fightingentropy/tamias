import { Inbox } from "@/site/components/inbox";
import { createSiteMetadata } from "@/site/page-metadata";

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
