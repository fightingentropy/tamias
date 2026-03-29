"use client";

import { CopyInput } from "@/components/copy-input";
import "@/styles/globals.css";
import { Button } from "@tamias/ui/button";
import { SUPPORT_EMAIL } from "@/utils/constants";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased">
        <div className="min-h-screen flex items-center justify-center">
          <div className="max-w-md w-full text-center px-4">
            <h2 className="font-medium mb-4">Something went wrong</h2>
            <p className="text-sm text-[#878787] mb-6">
              Something failed while rendering this page.
              <br />
              If this issue persists, please reach out to our support team.
            </p>

            <CopyInput value={SUPPORT_EMAIL} />

            {error.digest && (
              <p className="text-xs text-[#4a4a4a] mt-4">
                Error ID: {error.digest}
              </p>
            )}

            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="mt-6"
            >
              Try again
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
