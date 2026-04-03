import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import {
  PreAccountingSitePage,
  preAccountingSiteMetadata,
} from "@/site/pages/static-pages";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/pre-accounting")({
  head: () => buildHeadFromMetadata(preAccountingSiteMetadata),
});
