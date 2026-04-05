const DOCUMENT_PAGE_CURSOR_PREFIX = "document:";

type IndexedDocumentCursorState = {
  sourceCursor: string | null;
  sourceExhausted: boolean;
  bufferedIds: string[];
};

export function decodeIndexedDocumentCursor(
  cursor: string | null | undefined,
): IndexedDocumentCursorState {
  if (!cursor?.startsWith(DOCUMENT_PAGE_CURSOR_PREFIX)) {
    return {
      sourceCursor: null,
      sourceExhausted: false,
      bufferedIds: [],
    };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(
        cursor.slice(DOCUMENT_PAGE_CURSOR_PREFIX.length),
        "base64url",
      ).toString("utf8"),
    ) as Partial<IndexedDocumentCursorState>;

    return {
      sourceCursor:
        typeof parsed.sourceCursor === "string" ? parsed.sourceCursor : null,
      sourceExhausted: parsed.sourceExhausted === true,
      bufferedIds: Array.isArray(parsed.bufferedIds)
        ? parsed.bufferedIds.filter(
            (bufferedId): bufferedId is string =>
              typeof bufferedId === "string",
          )
        : [],
    };
  } catch {
    return {
      sourceCursor: null,
      sourceExhausted: false,
      bufferedIds: [],
    };
  }
}

export function encodeIndexedDocumentCursor(state: IndexedDocumentCursorState) {
  return `${DOCUMENT_PAGE_CURSOR_PREFIX}${Buffer.from(
    JSON.stringify(state),
    "utf8",
  ).toString("base64url")}`;
}

export function getIndexedDocumentBatchSize(pageSize: number) {
  return Math.min(Math.max(pageSize * 3, 50), 200);
}

export function getIndexedDocumentSearchLimit(pageSize: number) {
  return Math.min(Math.max(pageSize * 20, 100), 400);
}
