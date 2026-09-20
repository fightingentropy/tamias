import { createFileRoute } from "@tanstack/react-router";
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { TermsPage } from "@/components/public/terms-page";

export const Route = createAppPublicFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms | Tamias" }] }),
  component: TermsPage,
});
