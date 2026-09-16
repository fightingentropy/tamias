import { createFileRoute } from "@tanstack/react-router";
import { createAppPublicFileRoute } from "@/start/route-hosts";
import { PasswordRecoveryForm } from "@/components/password-recovery-form";
import Link from "@/framework/link";
import { LogoSmallIcon } from "@/start/components/app-shell-icons";

export const Route = createAppPublicFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password | Tamias" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm space-y-8">
        <Link href="/login" aria-label="Tamias sign in" className="inline-flex">
          <LogoSmallIcon className="size-7 text-foreground" />
        </Link>
        <PasswordRecoveryForm />
      </div>
    </main>
  );
}
