import { createLazyFileRoute } from "@tanstack/react-router";
import { AccountSettings } from "@/components/account-settings";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { loadAccountData } from "./index";

export const Route = createLazyFileRoute("/account/")({
  component: AccountPage,
});

function AccountPage() {
  const loaderData = Route.useLoaderData() as Awaited<ReturnType<typeof loadAccountData>>;

  return (
    <AppLayoutShell dehydratedState={loaderData.dehydratedState} user={loaderData.user}>
      <AccountSettings />
    </AppLayoutShell>
  );
}
