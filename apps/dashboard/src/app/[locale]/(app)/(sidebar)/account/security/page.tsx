import type { Metadata } from "next";
import { DeleteAccount } from "@/components/delete-account";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = {
  title: "Security | Tamias",
};

export default async function Security() {
  return (
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
  );
}
