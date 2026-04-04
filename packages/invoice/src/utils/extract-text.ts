import { isValidJSON } from "./content";

const BLOCK_NODE_TYPES = new Set([
  "blockquote",
  "bulletList",
  "codeBlock",
  "doc",
  "hardBreak",
  "heading",
  "horizontalRule",
  "listItem",
  "orderedList",
  "paragraph",
  "table",
  "tableCell",
  "tableHeader",
  "tableRow",
]);

function extractTextFromNode(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => extractTextFromNode(item))
      .filter(Boolean)
      .join(" ");
  }

  const node = value as {
    content?: unknown;
    text?: unknown;
    type?: unknown;
  };

  if (typeof node.text === "string") {
    return node.text;
  }

  const childText = extractTextFromNode(node.content);

  if (!childText) {
    return "";
  }

  if (
    typeof node.type === "string" &&
    BLOCK_NODE_TYPES.has(node.type)
  ) {
    return `${childText}\n`;
  }

  return childText;
}

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts text content from various JSON formats, including TipTap rich text
 * @param value - The value to extract text from (string or JSON string)
 * @returns The extracted text content or the original value if extraction fails
 */
export function extractTextFromValue(value: string): string {
  if (isValidJSON(value)) {
    try {
      const parsed = JSON.parse(value);

      // If it's a string, return as is
      if (typeof parsed === "string") {
        return parsed;
      }

      if (typeof parsed === "object" && parsed !== null) {
        try {
          const textContent = normalizeExtractedText(
            extractTextFromNode(parsed),
          );

          if (textContent.trim()) {
            return textContent.trim();
          }
        } catch {
          // If extraction fails, return original value
          return value;
        }
      }
    } catch {
      // If parsing fails, return original value
      return value;
    }
  }

  return value;
}
