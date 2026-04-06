"use client";

import type { JSONContent } from "@tiptap/react";
import { useState } from "react";
import dynamic from "@/framework/dynamic";
import { InvoiceEditorPreview } from "./invoice-editor-preview";

type Props = {
  initialContent?: JSONContent;
  className?: string;
  onChange?: (content?: JSONContent | null) => void;
  onBlur?: (content: JSONContent | null) => void;
  placeholder?: string;
  disablePlaceholder?: boolean;
  tabIndex?: number;
};

const EditorCore = dynamic(() => import("./editor-core").then((mod) => mod.EditorCore), {
  ssr: false,
});

export function Editor({
  initialContent,
  className,
  onChange,
  onBlur,
  placeholder,
  disablePlaceholder = false,
  tabIndex,
}: Props) {
  const [isActive, setIsActive] = useState(false);

  if (!isActive) {
    return (
      <InvoiceEditorPreview
        content={initialContent ?? null}
        className={className}
        placeholder={placeholder}
        disablePlaceholder={disablePlaceholder}
        tabIndex={tabIndex}
        onActivate={() => setIsActive(true)}
      />
    );
  }

  return (
    <EditorCore
      initialContent={initialContent}
      className={className}
      onChange={onChange}
      onBlur={onBlur}
      placeholder={placeholder}
      disablePlaceholder={disablePlaceholder}
      tabIndex={tabIndex}
      autoFocus
    />
  );
}
