import { randomUUID } from "node:crypto";
import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";

export type DocumentProcessingStatus = "pending" | "processing" | "completed" | "failed";

export type DocumentRecord = {
  id: string;
  teamId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
  pathTokens: string[];
  parentId: string | null;
  objectId: string | null;
  ownerId: string | null;
  tag: string | null;
  title: string | null;
  body: string | null;
  summary: string | null;
  content: string | null;
  date: string | null;
  language: string | null;
  processingStatus: DocumentProcessingStatus;
};

export type DocumentRecordPage = {
  page: DocumentRecord[];
  isDone: boolean;
  continueCursor: string | null;
};

export type UpsertDocumentInput = {
  teamId: string;
  id?: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown> | null;
  pathTokens?: string[];
  parentId?: string | null;
  objectId?: string | null;
  ownerId?: string | null;
  tag?: string | null;
  title?: string | null;
  body?: string | null;
  summary?: string | null;
  content?: string | null;
  date?: string | null;
  language?: string | null;
  processingStatus?: DocumentProcessingStatus;
};

export type UpdateDocumentByNameInput = {
  teamId: string;
  name: string;
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  body?: string | null;
  tag?: string | null;
  date?: string | null;
  language?: string | null;
  processingStatus?: DocumentProcessingStatus;
  metadata?: Record<string, unknown> | null;
};

type DocumentRecordRow = {
  id: string;
  team_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  metadata_json: string | null;
  path_tokens_json: string;
  parent_id: string | null;
  object_id: string | null;
  owner_id: string | null;
  tag: string | null;
  title: string | null;
  body: string | null;
  summary: string | null;
  content: string | null;
  date: string | null;
  language: string | null;
  processing_status: DocumentProcessingStatus;
};

type DocumentCursor = {
  createdAt: string;
  id: string;
};

function getDocumentsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function parseMetadata(value: string | null) {
  if (!value) {
    return null;
  }

  return JSON.parse(value) as Record<string, unknown>;
}

function toDocumentRecord(row: DocumentRecordRow): DocumentRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: parseMetadata(row.metadata_json),
    pathTokens: JSON.parse(row.path_tokens_json) as string[],
    parentId: row.parent_id,
    objectId: row.object_id,
    ownerId: row.owner_id,
    tag: row.tag,
    title: row.title,
    body: row.body,
    summary: row.summary,
    content: row.content,
    date: row.date,
    language: row.language,
    processingStatus: row.processing_status,
  };
}

function getDocumentSearchText(document: Partial<DocumentRecord>) {
  return [
    document.name,
    document.title,
    document.summary,
    document.body,
    document.content,
    document.tag,
    document.language,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function encodeDocumentCursor(cursor: DocumentCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeDocumentCursor(cursor: string | null | undefined): DocumentCursor | null {
  if (!cursor) {
    return null;
  }

  const parsed = JSON.parse(
    Buffer.from(cursor, "base64url").toString("utf8"),
  ) as Partial<DocumentCursor>;

  if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
    throw new Error("Invalid document cursor");
  }

  return {
    createdAt: parsed.createdAt,
    id: parsed.id,
  };
}

async function getDocumentByNameFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; name: string },
) {
  const row = await d1
    .prepare("select * from documents where team_id = ? and name = ? limit 1")
    .bind(params.teamId, params.name)
    .first<DocumentRecordRow>();

  return row ? toDocumentRecord(row) : null;
}

async function getDocumentByIdFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; documentId: string },
) {
  const row = await d1
    .prepare("select * from documents where team_id = ? and id = ? limit 1")
    .bind(params.teamId, params.documentId)
    .first<DocumentRecordRow>();

  return row ? toDocumentRecord(row) : null;
}

export async function getDocumentsPage(
  db: Database,
  args: {
    teamId: string;
    cursor?: string | null;
    pageSize: number;
    order?: "asc" | "desc";
  },
): Promise<DocumentRecordPage> {
  const d1 = getDocumentsD1(db);
  const order = args.order ?? "desc";
  const pageSize = Math.max(1, Math.min(args.pageSize, 500));
  const cursor = decodeDocumentCursor(args.cursor ?? null);
  const bindings: unknown[] = [args.teamId];
  const conditions = ["team_id = ?"];

  if (cursor) {
    const operator = order === "asc" ? ">" : "<";
    conditions.push(`(created_at ${operator} ? or (created_at = ? and id ${operator} ?))`);
    bindings.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }

  bindings.push(pageSize + 1);

  const { results = [] } = await d1
    .prepare(
      `select *
       from documents
       where ${conditions.join(" and ")}
       order by created_at ${order}, id ${order}
       limit ?`,
    )
    .bind(...bindings)
    .all<DocumentRecordRow>();
  const pageRows = results.slice(0, pageSize);
  const hasNextPage = results.length > pageSize;
  const lastRow = pageRows.at(-1) ?? null;

  return {
    page: pageRows.map(toDocumentRecord),
    isDone: !hasNextPage,
    continueCursor:
      hasNextPage && lastRow
        ? encodeDocumentCursor({
            createdAt: lastRow.created_at,
            id: lastRow.id,
          })
        : null,
  };
}

export async function searchDocuments(
  db: Database,
  args: { teamId: string; query: string; limit?: number },
) {
  const tokens = args.query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(args.limit ?? 100, 500));
  const conditions = ["team_id = ?", ...tokens.map(() => "search_text like ?")];
  const bindings: unknown[] = [args.teamId, ...tokens.map((token) => `%${token}%`), limit];
  const { results = [] } = await getDocumentsD1(db)
    .prepare(
      `select *
       from documents
       where ${conditions.join(" and ")}
       order by created_at desc, id desc
       limit ?`,
    )
    .bind(...bindings)
    .all<DocumentRecordRow>();

  return results.map(toDocumentRecord);
}

export async function getDocumentsByIds(
  db: Database,
  args: { teamId: string; documentIds: string[] },
) {
  if (args.documentIds.length === 0) {
    return [];
  }

  const placeholders = args.documentIds.map(() => "?").join(", ");
  const { results = [] } = await getDocumentsD1(db)
    .prepare(
      `select *
       from documents
       where team_id = ? and id in (${placeholders})`,
    )
    .bind(args.teamId, ...args.documentIds)
    .all<DocumentRecordRow>();

  return results.map(toDocumentRecord);
}

export async function getDocumentById(db: Database, args: { teamId: string; documentId: string }) {
  return getDocumentByIdFromD1(getDocumentsD1(db), args);
}

export async function getDocumentByName(db: Database, args: { teamId: string; name: string }) {
  return getDocumentByNameFromD1(getDocumentsD1(db), args);
}

export async function upsertDocuments(db: Database, args: { documents: UpsertDocumentInput[] }) {
  if (args.documents.length === 0) {
    return [];
  }

  const d1 = getDocumentsD1(db);
  const results: DocumentRecord[] = [];

  for (const document of args.documents) {
    const timestamp = new Date().toISOString();
    const existing = await getDocumentByNameFromD1(d1, {
      teamId: document.teamId,
      name: document.name,
    });
    const id = document.id ?? existing?.id ?? randomUUID();
    const createdAt = document.createdAt ?? existing?.createdAt ?? timestamp;
    const updatedAt = document.updatedAt ?? timestamp;
    const pathTokens = document.pathTokens ?? existing?.pathTokens ?? document.name.split("/");
    const metadata =
      document.metadata !== undefined ? document.metadata : (existing?.metadata ?? null);
    const nextDocument: DocumentRecord = {
      id,
      teamId: document.teamId,
      name: document.name,
      createdAt,
      updatedAt,
      metadata,
      pathTokens,
      parentId: document.parentId !== undefined ? document.parentId : (existing?.parentId ?? null),
      objectId: document.objectId !== undefined ? document.objectId : (existing?.objectId ?? null),
      ownerId: document.ownerId !== undefined ? document.ownerId : (existing?.ownerId ?? null),
      tag: document.tag !== undefined ? document.tag : (existing?.tag ?? null),
      title: document.title !== undefined ? document.title : (existing?.title ?? null),
      body: document.body !== undefined ? document.body : (existing?.body ?? null),
      summary: document.summary !== undefined ? document.summary : (existing?.summary ?? null),
      content: document.content !== undefined ? document.content : (existing?.content ?? null),
      date: document.date !== undefined ? document.date : (existing?.date ?? null),
      language: document.language !== undefined ? document.language : (existing?.language ?? null),
      processingStatus: document.processingStatus ?? existing?.processingStatus ?? "pending",
    };
    const searchText = getDocumentSearchText(nextDocument);

    await d1
      .prepare(
        `insert into documents (
          id,
          team_id,
          name,
          created_at,
          updated_at,
          metadata_json,
          path_tokens_json,
          parent_id,
          object_id,
          owner_id,
          tag,
          title,
          body,
          summary,
          content,
          date,
          language,
          processing_status,
          search_text
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(team_id, name) do update set
          updated_at = excluded.updated_at,
          metadata_json = excluded.metadata_json,
          path_tokens_json = excluded.path_tokens_json,
          parent_id = excluded.parent_id,
          object_id = excluded.object_id,
          owner_id = excluded.owner_id,
          tag = excluded.tag,
          title = excluded.title,
          body = excluded.body,
          summary = excluded.summary,
          content = excluded.content,
          date = excluded.date,
          language = excluded.language,
          processing_status = excluded.processing_status,
          search_text = excluded.search_text`,
      )
      .bind(
        nextDocument.id,
        nextDocument.teamId,
        nextDocument.name,
        nextDocument.createdAt,
        nextDocument.updatedAt,
        nextDocument.metadata ? JSON.stringify(nextDocument.metadata) : null,
        JSON.stringify(nextDocument.pathTokens),
        nextDocument.parentId,
        nextDocument.objectId,
        nextDocument.ownerId,
        nextDocument.tag,
        nextDocument.title,
        nextDocument.body,
        nextDocument.summary,
        nextDocument.content,
        nextDocument.date,
        nextDocument.language,
        nextDocument.processingStatus,
        searchText,
      )
      .run();

    const updated = await getDocumentByNameFromD1(d1, {
      teamId: nextDocument.teamId,
      name: nextDocument.name,
    });

    if (updated) {
      results.push(updated);
    }
  }

  return results;
}

export async function updateDocumentByName(db: Database, args: UpdateDocumentByNameInput) {
  return upsertDocuments(db, {
    documents: [
      {
        ...args,
        pathTokens: args.name.split("/"),
      },
    ],
  });
}

export async function deleteDocumentRecord(db: Database, args: { teamId: string; id: string }) {
  const d1 = getDocumentsD1(db);
  const document = await getDocumentByIdFromD1(d1, {
    teamId: args.teamId,
    documentId: args.id,
  });

  if (!document) {
    return null;
  }

  await d1
    .prepare("delete from documents where team_id = ? and id = ?")
    .bind(args.teamId, args.id)
    .run();

  return document;
}

export async function updateDocumentsStatusByNames(
  db: Database,
  args: { teamId: string; names: string[]; processingStatus: DocumentProcessingStatus },
) {
  const results: DocumentRecord[] = [];

  for (const name of args.names) {
    results.push(
      ...(await updateDocumentByName(db, {
        teamId: args.teamId,
        name,
        processingStatus: args.processingStatus,
      })),
    );
  }

  return results;
}

export async function updateDocumentProcessingStatus(
  db: Database,
  args: { id: string; processingStatus: DocumentProcessingStatus },
) {
  const d1 = getDocumentsD1(db);
  const existing = await d1
    .prepare("select team_id from documents where id = ? limit 1")
    .bind(args.id)
    .first<{ team_id: string }>();

  if (!existing) {
    return [];
  }

  const timestamp = new Date().toISOString();
  await d1
    .prepare("update documents set processing_status = ?, updated_at = ? where id = ?")
    .bind(args.processingStatus, timestamp, args.id)
    .run();

  return [{ id: args.id }];
}
