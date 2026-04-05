import type { DocumentRecord } from "../../../convex";

export function isFolderPlaceholder(document: Pick<DocumentRecord, "name">) {
  return document.name.endsWith(".folderPlaceholder");
}

export function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function normalizeDocumentQuery(query: string | null | undefined) {
  const normalized = query?.trim();
  return normalized ? normalized : null;
}

function tokenizeDocumentText(document: Partial<DocumentRecord>) {
  const combined = [
    document.title,
    document.summary,
    document.body,
    document.content,
    document.tag,
    document.name,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(" ");

  return new Set(
    combined
      .split(/[^a-z0-9]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  );
}

export function matchesQuery(document: DocumentRecord, query: string) {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return true;
  }

  const haystack = [
    document.name,
    document.title,
    document.summary,
    document.body,
    document.content,
    document.tag,
  ]
    .map((value) => normalizeText(value))
    .join("\n");

  return tokens.every((token) => haystack.includes(token));
}

export function matchesDateRange(
  document: Pick<DocumentRecord, "date">,
  start?: string | null,
  end?: string | null,
) {
  if (!(start && end)) {
    return true;
  }

  if (!document.date) {
    return false;
  }

  return document.date >= start && document.date <= end;
}

function calculateDocumentSimilarity(
  left: Partial<DocumentRecord>,
  right: Partial<DocumentRecord>,
) {
  const leftTerms = tokenizeDocumentText(left);
  const rightTerms = tokenizeDocumentText(right);

  if (leftTerms.size === 0 || rightTerms.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const term of leftTerms) {
    if (rightTerms.has(term)) {
      intersection += 1;
    }
  }

  return intersection / Math.max(leftTerms.size, rightTerms.size);
}

export function getDocumentSimilarity(
  left: Partial<DocumentRecord>,
  right: Partial<DocumentRecord>,
) {
  return calculateDocumentSimilarity(left, right);
}
