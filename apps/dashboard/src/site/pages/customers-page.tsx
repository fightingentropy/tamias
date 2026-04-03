import { Customers } from "@/site/components/customers";
import { createSiteMetadata } from "@/site/page-metadata";

export const customersSiteMetadata = createSiteMetadata({
  title: "Customer Management",
  description:
    "Know your customers better. Track customer performance, payment history, and outstanding invoices all in one place.",
  path: "/customers",
});

export function CustomersSitePage() {
  return <Customers />;
}
