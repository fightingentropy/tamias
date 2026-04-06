"use client";

import { cn } from "@tamias/ui/cn";
import {
  SlashCommand,
  type SlashCommandItem,
  SlashMenu,
  type SlashMenuRef,
} from "@tamias/ui/editor/extentions/slash-command";
import { createMinimalEditorExtensions } from "@tamias/ui/editor/extentions/register";
import { formatAmount } from "@tamias/utils/format";
import { useQuery } from "@tanstack/react-query";
import { EditorContent, type JSONContent, ReactRenderer, useEditor } from "@tiptap/react";
import { format } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import tippy, { type Instance } from "tippy.js";
import { useTRPC } from "@/trpc/client";
import { formatBankPaymentDetails, formatBankPreview } from "./utils/format-bank-details";

type InvoiceEditorProps = {
  initialContent?: JSONContent;
  className?: string;
  onChange?: (content?: JSONContent | null) => void;
  onBlur?: (content: JSONContent | null) => void;
  placeholder?: string;
  disablePlaceholder?: boolean;
  tabIndex?: number;
  autoFocus?: boolean;
};

export function InvoiceEditorCore({
  initialContent,
  className,
  onChange,
  onBlur,
  placeholder = "Type / to insert details",
  disablePlaceholder = false,
  tabIndex,
  autoFocus = false,
}: InvoiceEditorProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isEmpty, setIsEmpty] = useState(!initialContent);

  const contentRef = useRef<JSONContent | null>(initialContent ?? null);
  const onBlurRef = useRef(onBlur);
  const onChangeRef = useRef(onChange);
  onBlurRef.current = onBlur;
  onChangeRef.current = onChange;

  const trpc = useTRPC();
  const { control } = useFormContext();

  const dueDate = useWatch({ control, name: "dueDate" });
  const amount = useWatch({ control, name: "amount" });
  const invoiceNumber = useWatch({ control, name: "invoiceNumber" });
  const customerName = useWatch({ control, name: "customerName" });
  const currency = useWatch({ control, name: "template.currency" });
  const dateFormat = useWatch({ control, name: "template.dateFormat" }) || "MM/dd/yyyy";

  const { data: bankAccounts = [] } = useQuery({
    ...trpc.bankAccounts.getWithPaymentInfo.queryOptions(),
    staleTime: 1000 * 60 * 5,
  });

  const slashCommandItems = useMemo((): SlashCommandItem[] => {
    const items: SlashCommandItem[] = [];

    if (bankAccounts.length > 0) {
      items.push({
        id: "bank-account",
        label: "Bank Account",
        hasSubmenu: true,
        submenuItems: bankAccounts.map((account) => ({
          id: account.id,
          label: account.name,
          description: account.bankName || formatBankPreview(account),
          command: ({ editor, range }) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent(formatBankPaymentDetails(account))
              .run();
          },
        })),
        command: () => {},
      });
    }

    items.push({
      id: "due-date",
      label: "Due Date",
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(dueDate ? format(new Date(dueDate), dateFormat) : "")
          .run();
      },
    });

    items.push({
      id: "amount",
      label: "Amount",
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(
            formatAmount({
              amount: amount || 0,
              currency: currency || "USD",
            }) || "",
          )
          .run();
      },
    });

    items.push({
      id: "invoice-number",
      label: "Invoice #",
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(invoiceNumber || "")
          .run();
      },
    });

    if (customerName) {
      items.push({
        id: "customer",
        label: "Customer",
        command: ({ editor, range }) => {
          editor.chain().focus().deleteRange(range).insertContent(customerName).run();
        },
      });
    }

    return items;
  }, [bankAccounts, dueDate, dateFormat, amount, currency, invoiceNumber, customerName]);

  const slashCommandItemsRef = useRef(slashCommandItems);
  slashCommandItemsRef.current = slashCommandItems;

  const editor = useEditor({
    extensions: [
      ...createMinimalEditorExtensions({ placeholder }),
      SlashCommand.configure({
        suggestion: {
          items: () => slashCommandItemsRef.current,
          render: () => {
            let component: ReactRenderer<SlashMenuRef> | null = null;
            let popup: Instance[] | null = null;

            return {
              onStart: (props) => {
                component = new ReactRenderer(SlashMenu, {
                  props: { ...props, items: slashCommandItemsRef.current },
                  editor: props.editor,
                });
                if (!props.clientRect) return;
                popup = tippy("body", {
                  getReferenceClientRect: props.clientRect as () => DOMRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                });
              },
              onUpdate: (props) => {
                component?.updateProps({
                  ...props,
                  items: slashCommandItemsRef.current,
                });
                if (props.clientRect) {
                  popup?.[0]?.setProps({
                    getReferenceClientRect: props.clientRect as () => DOMRect,
                  });
                }
              },
              onKeyDown: (props) => {
                if (props.event.key === "Escape") {
                  const handled = component?.ref?.onKeyDown(props) ?? false;
                  if (!handled) {
                    popup?.[0]?.hide();
                  }
                  return true;
                }
                return component?.ref?.onKeyDown(props) ?? false;
              },
              onExit: () => {
                popup?.[0]?.destroy();
                component?.destroy();
              },
            };
          },
        },
      }),
    ],
    content: initialContent,
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    onFocus: () => setIsFocused(true),
    onBlur: () => {
      setIsFocused(false);
      onBlurRef.current?.(contentRef.current);
    },
    onUpdate: ({ editor }) => {
      const newIsEmpty = editor.state.doc.textContent.length === 0;
      const newContent = newIsEmpty ? null : editor.getJSON();
      contentRef.current = newContent;
      setIsEmpty(newIsEmpty);
      onChangeRef.current?.(newContent);
    },
  });

  useEffect(() => {
    if (!editor || editor.isFocused) return;

    const editorIsEmpty = editor.state.doc.textContent.length === 0;
    const newIsEmpty = !initialContent;

    if (editorIsEmpty && newIsEmpty) return;

    if (
      editorIsEmpty !== newIsEmpty ||
      JSON.stringify(editor.getJSON()) !== JSON.stringify(initialContent)
    ) {
      editor.commands.setContent(initialContent ?? "");
      contentRef.current = initialContent ?? null;
      setIsEmpty(newIsEmpty);
    }
  }, [initialContent, editor]);

  const showStripedBackground = !disablePlaceholder && isEmpty && !isFocused;

  if (!editor) return null;

  return (
    <div
      className={cn(
        !isFocused && "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-['']",
      )}
    >
      <EditorContent
        editor={editor}
        className={cn(
          "text-[11px] text-primary leading-[18px] invoice-editor",
          showStripedBackground &&
            "w-full bg-[repeating-linear-gradient(-60deg,#DBDBDB,#DBDBDB_1px,transparent_1px,transparent_5px)] dark:bg-[repeating-linear-gradient(-60deg,#2C2C2C,#2C2C2C_1px,transparent_1px,transparent_5px)]",
          className,
        )}
        tabIndex={tabIndex}
      />
    </div>
  );
}
