import { createFileRoute } from "@tanstack/react-router";
import {
  FileStorageSitePage,
  fileStorageSiteMetadata,
} from "@/site/pages/static-pages";
import { SiteLayoutShell } from "@/start/root-shell";
import { buildHeadFromMetadata } from "@/start/site-head";

export const Route = createFileRoute("/file-storage")({
  head: () => buildHeadFromMetadata(fileStorageSiteMetadata),
  component: () => (
    <SiteLayoutShell>
      <FileStorageSitePage />
    </SiteLayoutShell>
  ),
});
