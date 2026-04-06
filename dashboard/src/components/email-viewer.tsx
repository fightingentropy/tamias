"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@tamias/ui/alert";
import { Icons } from "@tamias/ui/icons";
import { Skeleton } from "@tamias/ui/skeleton";
import { type EmailPreviewData, parseEmailPreview } from "@/lib/email-preview";

type EmailViewerProps = {
  url: string;
};

function LoadingViewer() {
  return <Skeleton className="w-full h-full" />;
}

export function EmailViewer({ url }: EmailViewerProps) {
  const [preview, setPreview] = useState<EmailPreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    const abortController = new AbortController();

    async function loadPreview() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(url, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Unable to load email preview (${response.status}).`);
        }

        const rawEmail = await response.text();

        if (!isActive) {
          return;
        }

        setPreview(parseEmailPreview(rawEmail));
      } catch (loadError) {
        if (!isActive || abortController.signal.aborted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load email preview.");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      isActive = false;
      abortController.abort();
    };
  }, [url]);

  if (isLoading) {
    return <LoadingViewer />;
  }

  if (error || !preview) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <Alert className="max-w-md">
          <AlertDescription>{error ?? "Unable to load email preview."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const metadata = [
    { label: "From", value: preview.from },
    { label: "To", value: preview.to },
    { label: "Date", value: preview.date },
  ].filter((item) => Boolean(item.value));

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="border-b px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full border p-2 text-muted-foreground">
            <Icons.Email className="size-5" />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h3 className="text-sm font-medium leading-5">
                {preview.subject || "Email message"}
              </h3>
            </div>

            {metadata.length > 0 && (
              <dl className="grid gap-2 text-xs text-muted-foreground">
                {metadata.map((item) => (
                  <div key={item.label} className="grid grid-cols-[40px_1fr] items-start gap-2">
                    <dt>{item.label}</dt>
                    <dd className="break-words text-foreground/80">{item.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-foreground">
          {preview.body}
        </pre>
      </div>
    </div>
  );
}
