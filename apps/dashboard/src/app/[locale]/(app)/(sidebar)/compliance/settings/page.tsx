import type { Metadata } from "next";
import { ComplianceSettingsForm } from "@/components/compliance/compliance-settings-form";
import { getComplianceProfileLocally } from "@/server/loaders/compliance";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Compliance Settings | Tamias",
};

export default async function ComplianceSettingsPage() {
  const queryClient = getQueryClient();
  const profile = await getComplianceProfileLocally();

  queryClient.setQueryData(trpc.compliance.getProfile.queryKey(), profile);

  return (
    <HydrateClient>
      <ComplianceSettingsForm />
    </HydrateClient>
  );
}
