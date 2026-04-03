import { NotFoundPage } from "@/start/components/not-found-page";
import { SiteLayoutShell } from "@/start/components/site-layout-shell";

export function SiteNotFoundPage() {
  return (
    <SiteLayoutShell>
      <NotFoundPage
        fullScreen={false}
        description="We could not find that page on the Tamias website."
        homeLabel="Back to home"
      />
    </SiteLayoutShell>
  );
}
