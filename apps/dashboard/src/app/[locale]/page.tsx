import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Tamias",
};

export default async function HomePage() {
  if (await isAuthenticatedNextjs()) {
    redirect("/dashboard");
  }

  redirect("/login");
}
