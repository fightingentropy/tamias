import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicHomepage } from "@/components/public-homepage";

export const metadata: Metadata = {
  title: "Tamias",
};

export default async function HomePage() {
  if (await isAuthenticatedNextjs()) {
    redirect("/dashboard");
  }

  return <PublicHomepage />;
}
