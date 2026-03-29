import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Security | Tamias",
};

export default function Setup() {
  redirect("/account/security");
}
