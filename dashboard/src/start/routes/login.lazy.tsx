import { createLazyFileRoute } from "@tanstack/react-router";
import dynamic from "@/framework/dynamic";
import Link from "@/framework/link";
import { LogoSmallIcon } from "@/start/components/app-shell-icons";
import { PasswordAuthForm } from "@/components/password-auth-form";

const LoginVideoBackground = dynamic(
  () => import("@/components/login-video-background").then((mod) => mod.LoginVideoBackground),
  {
    ssr: false,
  },
);

export const Route = createLazyFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex relative">
      <nav className="fixed top-0 left-0 right-0 z-50 w-full pointer-events-none">
        <div className="relative py-3 xl:py-4 px-4 sm:px-4 md:px-4 lg:px-4 xl:px-6 2xl:px-8 flex items-center">
          <Link
            href="/"
            className="flex items-center gap-2 hover:opacity-80 active:opacity-80 transition-opacity duration-200 pointer-events-auto"
          >
            <div className="w-6 h-6">
              <LogoSmallIcon className="w-full h-full text-foreground lg:text-white" />
            </div>
          </Link>
        </div>
      </nav>

      {/* Reserve left half for video so form doesn't shift on load */}
      <div className="hidden lg:block lg:w-1/2 relative min-h-screen bg-black">
        <LoginVideoBackground />
      </div>

      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-12 pb-2">
        <div className="w-full max-w-md flex flex-col h-full">
          <div className="space-y-8 flex-1 flex flex-col justify-center">
            <div className="text-center space-y-2">
              <h1 className="text-lg lg:text-xl mb-4 font-serif">Welcome to Tamias</h1>
              <p className="font-sans text-sm text-[#878787]">
                Sign in with your email and password
              </p>
            </div>

            <PasswordAuthForm />
          </div>

          <div className="text-center mt-auto">
            <p className="font-sans text-xs text-[#878787]">
              By signing in you agree to Tamias&apos; terms of service and privacy policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
