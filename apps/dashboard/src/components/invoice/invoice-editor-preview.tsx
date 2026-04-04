"use client";

import { formatEditorContent } from "@tamias/invoice/format-to-html";
import { cn } from "@tamias/ui/cn";
import type { JSONContent } from "@tiptap/react";
import type { KeyboardEvent, MouseEvent } from "react";

type Props = {
  content?: JSONContent | null;
  className?: string;
  placeholder?: string;
  disablePlaceholder?: boolean;
  tabIndex?: number;
  onActivate: () => void;
};

export function InvoiceEditorPreview({
  content,
  className,
  placeholder = "Write something...",
  disablePlaceholder = false,
  tabIndex,
  onActivate,
}: Props) {
  const hasContent = Boolean(content?.content?.length);

  const handleActivate = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    onActivate();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate();
    }
  };

  return (
    <div
      role="button"
      tabIndex={tabIndex ?? 0}
      onMouseDown={handleActivate}
      onKeyDown={handleKeyDown}
      className={cn(
        "invoice-editor cursor-text text-[11px] leading-[18px] text-primary outline-none [&_a]:pointer-events-none",
        !hasContent &&
          !disablePlaceholder &&
          "w-full bg-[repeating-linear-gradient(-60deg,#DBDBDB,#DBDBDB_1px,transparent_1px,transparent_5px)] dark:bg-[repeating-linear-gradient(-60deg,#2C2C2C,#2C2C2C_1px,transparent_1px,transparent_5px)]",
        className,
      )}
    >
      {hasContent ? (
        formatEditorContent(content as never)
      ) : (
        <span className="text-[#878787]">{disablePlaceholder ? "" : placeholder}</span>
      )}
    </div>
  );
}
