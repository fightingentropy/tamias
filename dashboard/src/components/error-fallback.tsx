"use client";

import { Button } from "@tamias/ui/button";
import { useRouter } from "@/framework/navigation";

type ErrorFallbackProps = {
  error?: Error;
  reset?: () => void;
};

export function ErrorFallback({ reset }: ErrorFallbackProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-4">
      <div>
        <h2 className="text-md">Something went wrong</h2>
      </div>
      <Button
        onClick={() => {
          if (reset) {
            reset();
            return;
          }

          router.refresh();
        }}
        variant="outline"
      >
        Try again
      </Button>
    </div>
  );
}
