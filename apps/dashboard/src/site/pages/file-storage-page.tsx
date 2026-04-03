import { FileStorage } from "@/site/components/file-storage";
import { createSiteMetadata } from "@/site/page-metadata";

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
