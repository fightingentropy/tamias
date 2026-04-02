import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { AccountSettings } from "@/components/account-settings";

const loadAccountData = createServerFn({ method: "GET" }).handler(async () => {
  const { buildAccountPageData } = await import("@/start/server/route-data");
  return (await buildAccountPageData()) as any;
});

export const Route = createFileRoute("/account/")({
  loader: () => loadAccountData(),
  head: () => ({
    meta: [{ title: "Account Settings | Tamias" }],
  }),
  component: AccountPage,
});

function AccountPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadAccountData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <AccountSettings />
    </AppLayoutShell>
  );
}
