function stripUtf8ByteOrderMark(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function stripLeadingXmlDeclaration(value: string) {
  return value.replace(/^\s*<\?xml[^>]*\?>\s*/i, "");
}

function stripInlineDoctype(value: string) {
  return value.replace(/^\s*<!DOCTYPE[\s\S]*?>\s*/i, "");
}

function normalizeInlineXbrlDocumentForCtSubmission(value: string) {
  return stripInlineDoctype(
    stripLeadingXmlDeclaration(stripUtf8ByteOrderMark(value)),
  ).trim();
}

export function encodeInlineXbrlDocumentForCtSubmission(value: string) {
  return Buffer.from(
    normalizeInlineXbrlDocumentForCtSubmission(value),
    "utf8",
  ).toString("base64");
}
