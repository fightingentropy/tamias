export {
  isFolderPlaceholder,
  normalizeText,
  normalizeDocumentQuery,
  matchesQuery,
  matchesDateRange,
  getDocumentSimilarity,
} from "./shared/text";
export {
  decodeIndexedDocumentCursor,
  encodeIndexedDocumentCursor,
  getIndexedDocumentBatchSize,
  getIndexedDocumentSearchLimit,
} from "./shared/cursors";
export {
  getRecentDocumentsPage,
  getDocumentSearchCandidates,
  getRelatedDocumentCandidates,
  getDocumentsByIdsInOrder,
} from "./shared/queries";
export { attachAssignments, deleteDocumentTagAssignments } from "./shared/assignments";
