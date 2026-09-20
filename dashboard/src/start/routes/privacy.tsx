import { createFileRoute } from "@tanstack/react-router";
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { PrivacyPage } from "@/components/public/privacy-page";

export const Route = createAppPublicFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy | Tamias" }] }),
  component: PrivacyPage,
});
