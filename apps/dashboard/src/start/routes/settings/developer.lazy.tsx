import { createLazyFileRoute } from "@tanstack/react-router";
import { AppLayoutShell } from "@/start/components/app-layout-shell";
import { AssistantProviderSettings } from "@/components/assistant-provider-settings";
import { CreateApiKeyModal } from "@/components/modals/create-api-key-modal";
import { DeleteApiKeyModal } from "@/components/modals/delete-api-key-modal";
import { EditApiKeyModal } from "@/components/modals/edit-api-key-modal";
import { OAuthSecretModal } from "@/components/modals/oauth-secret-modal";
import { OAuthApplicationCreateSheet } from "@/components/sheets/oauth-application-create-sheet";
import { OAuthApplicationEditSheet } from "@/components/sheets/oauth-application-edit-sheet";
import { DataTable } from "@/components/tables/api-keys";
import { OAuthDataTable } from "@/components/tables/oauth-applications";
import { loadSettingsDeveloperData } from "./developer";

export const Route = createLazyFileRoute("/settings/developer")({
  component: SettingsDeveloperPage,
});

function SettingsDeveloperPage() {
  const loaderData = Route.useLoaderData() as Awaited<
    ReturnType<typeof loadSettingsDeveloperData>
  >;

  return (
    <AppLayoutShell
      dehydratedState={loaderData.dehydratedState}
      user={loaderData.user}
    >
      <>
        <div className="space-y-12">
          <AssistantProviderSettings />
          <DataTable />
          <OAuthDataTable />
        </div>

        <EditApiKeyModal />
        <DeleteApiKeyModal />
        <CreateApiKeyModal />
        <OAuthSecretModal />
        <OAuthApplicationCreateSheet />
        <OAuthApplicationEditSheet />
      </>
    </AppLayoutShell>
  );
}
