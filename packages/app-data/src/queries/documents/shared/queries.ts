import {
  getDocumentsByIdsFromConvex,
  getDocumentsPageFromConvex,
  searchDocumentsFromConvex,
  type DocumentRecord,
} from "@tamias/app-data-convex";
import { isFolderPlaceholder, normalizeText } from "./text";

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

function getRelatedDocumentSearchQueries(document: Partial<DocumentRecord>) {
  const tokenQuery = [...tokenizeDocumentText(document)].slice(0, 6).join(" ");

  return [
    document.title,
    document.tag,
    document.name
      ?.split("/")
      .pop()
      ?.replace(/\.[^.]+$/, ""),
    tokenQuery,
  ]
    .map((value) => normalizeText(value))
    .filter((value, index, values) => value.length >= 3 && values.indexOf(value) === index);
}

export async function getRecentDocumentsPage(args: { teamId: string; limit: number }) {
  const documents: DocumentRecord[] = [];
  let cursor: string | null = null;

  while (documents.length < args.limit) {
    const result = await getDocumentsPageFromConvex({
      teamId: args.teamId,
      cursor,
      pageSize: Math.max(args.limit * 2, 20),
      order: "desc",
    });

    documents.push(...result.page.filter((document) => !isFolderPlaceholder(document)));

    if (result.isDone) {
      break;
    }

    cursor = result.continueCursor;
  }

  return documents.slice(0, args.limit);
}

export async function getDocumentSearchCandidates(args: {
  teamId: string;
  query: string;
  limit: number;
}) {
  return (
    await searchDocumentsFromConvex({
      teamId: args.teamId,
      query: args.query,
      limit: args.limit,
    })
  )
    .filter((document) => !isFolderPlaceholder(document))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getRelatedDocumentCandidates(args: {
  teamId: string;
  source: DocumentRecord;
  pageSize: number;
}) {
  const queries = getRelatedDocumentSearchQueries(args.source);

  if (queries.length === 0) {
    return [];
  }

  const searchResults = await Promise.all(
    queries.map((query) =>
      searchDocumentsFromConvex({
        teamId: args.teamId,
        query,
        limit: Math.max(args.pageSize * 4, 20),
      }),
    ),
  );

  return [
    ...new Map(
      searchResults
        .flat()
        .filter((document) => !isFolderPlaceholder(document))
        .filter((document) => document.id !== args.source.id)
        .map((document) => [document.id, document]),
    ).values(),
  ];
}

export async function getDocumentsByIdsInOrder(args: { teamId: string; documentIds: string[] }) {
  if (args.documentIds.length === 0) {
    return [];
  }

  const documents = (
    await Promise.all(
      Array.from(
        {
          length: Math.ceil(args.documentIds.length / 200),
        },
        (_, index) =>
          getDocumentsByIdsFromConvex({
            teamId: args.teamId,
            documentIds: args.documentIds.slice(index * 200, (index + 1) * 200),
          }),
      ),
    )
  ).flat();
  const documentsById = new Map(documents.map((document) => [document.id, document]));

  return args.documentIds.flatMap((documentId) => {
    const document = documentsById.get(documentId);

    return document ? [document] : [];
  });
}
