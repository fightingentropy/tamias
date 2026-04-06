"use client";

import { useMemo, useState } from "react";
import { cn } from "@tamias/ui/cn";
import { Skeleton } from "@tamias/ui/skeleton";

interface PdfViewerProps {
  url: string;
  maxWidth?: number;
}

function LoadingViewer() {
  return <Skeleton className="h-[calc(100vh-theme(spacing.24))] w-full" />;
}

export function PdfViewer({ url, maxWidth }: PdfViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const viewerUrl = useMemo(() => {
    if (!url) {
      return "";
    }

    if (url.includes("#")) {
      return url;
    }

    return `${url}#view=FitH&toolbar=0&navpanes=0&scrollbar=0`;
  }, [url]);

  if (!viewerUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Unable to load this PDF.</p>
      </div>
    );
  }

  return (
    <div className={cn("relative flex h-full w-full justify-center bg-white")}>
      {isLoading && (
        <div className="absolute inset-0">
          <LoadingViewer />
        </div>
      )}

      <iframe
        src={viewerUrl}
        title="PDF document"
        className={cn("h-full w-full", isLoading && "opacity-0")}
        style={maxWidth ? { maxWidth } : undefined}
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
}
