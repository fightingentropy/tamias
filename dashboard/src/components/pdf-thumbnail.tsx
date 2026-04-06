"use client";

import { cn } from "@tamias/ui/cn";
import { FilePreviewIcon } from "@/components/file-preview-icon";

type Props = {
  className?: string;
};

export function PdfThumbnail({ className }: Props) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center border border-border bg-primary/10 dark:border-none",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <FilePreviewIcon mimetype="application/pdf" className="size-10" />
        <span className="text-[10px] font-medium uppercase tracking-[0.2em]">PDF</span>
      </div>
    </div>
  );
}
