import { createFileRoute } from "@tanstack/react-router";
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { SupportPage } from "@/components/public/support-page";

export const Route = createAppPublicFileRoute("/support")({
  head: () => ({ meta: [{ title: "Support | Tamias" }] }),
  component: SupportPage,
});
