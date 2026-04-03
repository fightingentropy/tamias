import "@/site/styles/globals.css";
import type { ReactNode } from "react";
import { Footer } from "@/site/components/footer";
import { Header as SiteHeader } from "@/site/components/header";
import { JsonLdScript } from "@/start/site-head";

const siteOrganizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Tamias",
  url: "https://tamias.xyz",
  logo: "https://cdn.tamias.xyz/logo.png",
  sameAs: [
    "https://x.com/tamias",
    "https://github.com/fightingentropy/tamias",
    "https://linkedin.com/company/tamias",
  ],
  description:
    "Tamias gives you one place for transactions, receipts, invoices and everything around your business finances without manual work.",
};

export function SiteLayoutShell(props: { children: ReactNode }) {
  return (
    <div className="bg-background overflow-x-hidden whitespace-normal">
      <JsonLdScript value={siteOrganizationJsonLd} />
      <SiteHeader />
      <main className="container mx-auto overflow-hidden px-4 md:overflow-visible">
        {props.children}
      </main>
      <Footer />
    </div>
  );
}
