import { createLazyFileRoute } from "@tanstack/react-router";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { SupportForm } from "@/components/support-form";
import { loadAccountSupportData } from "./support";

export const Route = createLazyFileRoute("/account/support")({
  component: AccountSupportPage,
});

function AccountSupportPage() {
  const loaderData = Route.useLoaderData() as Awaited<ReturnType<typeof loadAccountSupportData>>;

  return (
    <AppLayoutShell dehydratedState={loaderData.dehydratedState} user={loaderData.user}>
      <div className="space-y-12">
        <div className="max-w-[450px]">
          <SupportForm />
        </div>
      </div>
    </AppLayoutShell>
  );
}
