import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import {
  AssistantSitePage,
  assistantSiteMetadata,
} from "@/site/pages/static-pages";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/assistant")({
  head: () => buildHeadFromMetadata(assistantSiteMetadata),
});
