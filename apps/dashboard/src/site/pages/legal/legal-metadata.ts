import type { SiteMetadata } from "@/site/metadata";
import { baseUrl } from "@/site/base-url";

const termsTitle = "Terms and Conditions";
const termsDescription =
  "Terms and Conditions for using Tamias. Read about your rights and responsibilities when using our service.";

export const termsMetadata: SiteMetadata = {
  title: termsTitle,
  description: termsDescription,
  openGraph: {
    title: termsTitle,
    description: termsDescription,
    type: "website",
    url: `${baseUrl}/terms`,
  },
  twitter: {
    card: "summary_large_image",
    title: termsTitle,
    description: termsDescription,
  },
  alternates: {
    canonical: `${baseUrl}/terms`,
  },
};

const policyTitle = "Privacy Policy";
const policyDescription =
  "Privacy Policy for Tamias. Learn how we collect, use, and protect your personal data.";

export const policyMetadata: SiteMetadata = {
  title: policyTitle,
  description: policyDescription,
  openGraph: {
    title: policyTitle,
    description: policyDescription,
    type: "website",
    url: `${baseUrl}/policy`,
  },
  twitter: {
    card: "summary_large_image",
    title: policyTitle,
    description: policyDescription,
  },
  alternates: {
    canonical: `${baseUrl}/policy`,
  },
};
