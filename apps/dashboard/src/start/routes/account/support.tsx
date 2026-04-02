import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { SupportForm } from "@/components/support-form";

const loadAccountSupportData = createServerFn({ method: "GET" }).handler(
  async () => {
    const { buildAccountSupportPageData } = await import(
      "@/start/server/route-data"
    );
    return (await buildAccountSupportPageData()) as any;
  },
);

export const Route = createFileRoute("/account/support")({
  loader: () => loadAccountSupportData(),
  head: () => ({
    meta: [{ title: "Support | Tamias" }],
  }),
  component: AccountSupportPage,
});

function AccountSupportPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadAccountSupportData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <div className="space-y-12">
        <div className="max-w-[450px]">
          <SupportForm />
        </div>
      </div>
    </AppLayoutShell>
  );
}
