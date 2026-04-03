import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import {
  FileStorageSitePage,
  fileStorageSiteMetadata,
} from "@/site/pages/static-pages";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/file-storage")({
  head: () => buildHeadFromMetadata(fileStorageSiteMetadata),
});
