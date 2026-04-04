// You can find the list of extensions here: https://tiptap.dev/docs/editor/extensions/functionality

import Bold from "@tiptap/extension-bold";
import Document from "@tiptap/extension-document";
import History from "@tiptap/extension-history";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Strike from "@tiptap/extension-strike";
import Text from "@tiptap/extension-text";
import Underline from "@tiptap/extension-underline";

const baseExtensions = [
  Document,
  Paragraph,
  Text,
  Bold,
  Italic,
  Strike,
  History,
  Underline,
  Link.configure({
    openOnClick: false,
    autolink: true,
    defaultProtocol: "https",
  }),
];

export function createMinimalEditorExtensions(options?: { placeholder?: string }) {
  const { placeholder } = options ?? {};

  if (!placeholder) {
    return baseExtensions;
  }

  return [...baseExtensions, Placeholder.configure({ placeholder })];
}

export function registerExtensions(options?: { placeholder?: string }) {
  return createMinimalEditorExtensions(options);
}
