import { createLazyFileRoute } from "@tanstack/react-router";
import { FileStorageSitePage } from "@/site/pages/file-storage-page";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export const Route = createLazyFileRoute("/file-storage")({
  component: FileStoragePage,
});

function FileStoragePage() {
  return (
    <SiteLayoutShell>
      <FileStorageSitePage />
    </SiteLayoutShell>
  );
}
