import type { Metadata } from "next";
import { AssistantProviderSettings } from "@/components/assistant-provider-settings";
import { CreateApiKeyModal } from "@/components/modals/create-api-key-modal";
import { DeleteApiKeyModal } from "@/components/modals/delete-api-key-modal";
import { EditApiKeyModal } from "@/components/modals/edit-api-key-modal";
import { OAuthSecretModal } from "@/components/modals/oauth-secret-modal";
import { OAuthApplicationCreateSheet } from "@/components/sheets/oauth-application-create-sheet";
import { OAuthApplicationEditSheet } from "@/components/sheets/oauth-application-edit-sheet";
import { DataTable } from "@/components/tables/api-keys";
import { OAuthDataTable } from "@/components/tables/oauth-applications";
import {
  getApiKeysLocally,
  getOAuthApplicationsLocally,
} from "@/server/loaders/apps";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Developer | Tamias",
};

export default async function Page() {
  const queryClient = getQueryClient();
  const apiKeysQuery = trpc.apiKeys.get.queryOptions();
  const oauthApplicationsQuery = trpc.oauthApplications.list.queryOptions();
  const [apiKeysResult, oauthApplicationsResult] = await Promise.allSettled([
    getApiKeysLocally(),
    getOAuthApplicationsLocally(),
  ]);

  if (apiKeysResult.status === "fulfilled") {
    queryClient.setQueryData(apiKeysQuery.queryKey, apiKeysResult.value);
  }

  if (oauthApplicationsResult.status === "fulfilled") {
    queryClient.setQueryData(
      oauthApplicationsQuery.queryKey,
      oauthApplicationsResult.value,
    );
  }

  return (
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
  );
}
