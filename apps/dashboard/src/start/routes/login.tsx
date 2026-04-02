import { createFileRoute } from "@tanstack/react-router";
import { getAppUrl, getWebsiteUrl } from "@tamias/utils/envs";
import { Icons } from "@tamias/ui/icons";
import Link from "@/framework/link";
import { LoginVideoBackground } from "@/components/login-video-background";
import { PasswordAuthForm } from "@/components/password-auth-form";

const appUrl = getAppUrl();
const websiteUrl = getWebsiteUrl();

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      {
        title: "Login | Tamias",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const showLocalDevHint =
    appUrl.includes("localhost") || appUrl.includes("127.0.0.1");

  return (
    <div className="min-h-screen bg-background flex relative">
      <nav className="fixed top-0 left-0 right-0 z-50 w-full pointer-events-none">
        <div className="relative py-3 xl:py-4 px-4 sm:px-4 md:px-4 lg:px-4 xl:px-6 2xl:px-8 flex items-center">
          <Link
            href={websiteUrl}
            className="flex items-center gap-2 hover:opacity-80 active:opacity-80 transition-opacity duration-200 pointer-events-auto"
          >
            <div className="w-6 h-6">
              <Icons.LogoSmall className="w-full h-full text-foreground lg:text-white" />
            </div>
          </Link>
        </div>
      </nav>

      <LoginVideoBackground />

      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-12 pb-2">
        <div className="w-full max-w-md flex flex-col h-full">
          <div className="space-y-8 flex-1 flex flex-col justify-center">
            <div className="text-center space-y-2">
              <h1 className="text-lg lg:text-xl mb-4 font-serif">
                Welcome to Tamias
              </h1>
              <p className="font-sans text-sm text-[#878787]">
                Sign in with your email and password
              </p>
              {showLocalDevHint ? (
                <p className="font-sans text-xs text-[#878787]">
                  Local development has no seeded demo account. Use Create one on
                  first run.
                </p>
              ) : null}
            </div>

            <PasswordAuthForm />
          </div>

          <div className="text-center mt-auto">
            <p className="font-sans text-xs text-[#878787]">
              By signing in you agree to our{" "}
              <Link
                href="https://tamias.xyz/terms"
                className="text-[#878787] hover:text-foreground transition-colors underline"
              >
                Terms of service
              </Link>{" "}
              &{" "}
              <Link
                href="https://tamias.xyz/policy"
                className="text-[#878787] hover:text-foreground transition-colors underline"
              >
                Privacy policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
