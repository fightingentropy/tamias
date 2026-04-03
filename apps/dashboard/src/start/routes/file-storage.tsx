import { createFileRoute } from "@tanstack/react-router"
import { createSiteFileRoute } from "@/start/route-hosts";
import { fileStorageSiteMetadata } from "@/site/pages/file-storage-page";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createSiteFileRoute("/file-storage")({
  head: () => buildHeadFromMetadata(fileStorageSiteMetadata),
});
