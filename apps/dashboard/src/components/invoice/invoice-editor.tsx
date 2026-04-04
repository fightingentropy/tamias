"use client";

import type { JSONContent } from "@tiptap/react";
import { useState } from "react";
import dynamic from "@/framework/dynamic";
import { InvoiceEditorPreview } from "./invoice-editor-preview";

type InvoiceEditorProps = {
  initialContent?: JSONContent;
  className?: string;
  onChange?: (content?: JSONContent | null) => void;
  onBlur?: (content: JSONContent | null) => void;
  placeholder?: string;
  disablePlaceholder?: boolean;
  tabIndex?: number;
};

const InvoiceEditorCore = dynamic(
  () => import("./invoice-editor-core").then((mod) => mod.InvoiceEditorCore),
  { ssr: false },
);

export function InvoiceEditor(props: InvoiceEditorProps) {
  const [isActive, setIsActive] = useState(false);

  if (!isActive) {
    return (
      <InvoiceEditorPreview
        content={props.initialContent ?? null}
        className={props.className}
        placeholder={props.placeholder}
        disablePlaceholder={props.disablePlaceholder}
        tabIndex={props.tabIndex}
        onActivate={() => setIsActive(true)}
      />
    );
  }

  return <InvoiceEditorCore {...props} autoFocus />;
}
