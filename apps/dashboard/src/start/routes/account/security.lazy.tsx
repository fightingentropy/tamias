import { createLazyFileRoute } from "@tanstack/react-router";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { DeleteAccount } from "@/components/delete-account";
import { SignOutButton } from "@/components/sign-out-button";
import { loadAccountSecurityData } from "./security";

export const Route = createLazyFileRoute("/account/security")({
  component: AccountSecurityPage,
});

function AccountSecurityPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadAccountSecurityData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <div className="space-y-12">
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Security</h2>
          <p className="text-sm text-muted-foreground">
            This workspace now uses a simple email and password sign-in flow.
            Multi-factor authentication has been removed.
          </p>
          <div className="max-w-sm">
            <SignOutButton />
          </div>
        </div>

        <DeleteAccount />
      </div>
    </AppLayoutShell>
  );
}
