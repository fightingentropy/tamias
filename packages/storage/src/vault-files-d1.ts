import { getStorageRuntime, type CloudflareD1DatabaseBinding } from "./runtime";

type VaultFileStorageProvider = "r2";

type VaultFileRecord = {
  path: string;
  teamId: string;
  pathTokens: string[];
  storageProvider: VaultFileStorageProvider;
  storageId: string;
  bucket: string;
  contentType: string | null;
  size: number | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type VaultFileRow = {
  path: string;
  team_id: string;
  path_tokens_json: string;
  storage_provider: VaultFileStorageProvider;
  storage_id: string;
  bucket: string;
  content_type: string | null;
  size: number | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type UpsertVaultFileIndexParams = {
  pathTokens: string[];
  storageProvider: VaultFileStorageProvider;
  storageId: string;
  teamId?: string | null;
  bucket?: string | null;
  contentType?: string | null;
  size?: number | null;
  uploadedBy?: string | null;
};

function getD1(): CloudflareD1DatabaseBinding | null {
  return getStorageRuntime().d1 ?? null;
}

function toPath(pathTokens: string[]) {
  return pathTokens.join("/");
}

function toVaultFileRecord(row: VaultFileRow): VaultFileRecord {
  return {
    path: row.path,
    teamId: row.team_id,
    pathTokens: JSON.parse(row.path_tokens_json) as string[],
    storageProvider: row.storage_provider,
    storageId: row.storage_id,
    bucket: row.bucket,
    contentType: row.content_type,
    size: row.size,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertVaultFileIndex(params: UpsertVaultFileIndexParams) {
  const d1 = getD1();

  if (!d1) {
    return;
  }

  const path = toPath(params.pathTokens);
  const teamId = params.teamId ?? params.pathTokens[0];

  if (!path || !teamId) {
    return;
  }

  const timestamp = new Date().toISOString();

  await d1
    .prepare(
      `insert into vault_files (
        path,
        team_id,
        path_tokens_json,
        storage_provider,
        storage_id,
        bucket,
        content_type,
        size,
        uploaded_by,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(path) do update set
        team_id = excluded.team_id,
        path_tokens_json = excluded.path_tokens_json,
        storage_provider = excluded.storage_provider,
        storage_id = excluded.storage_id,
        bucket = excluded.bucket,
        content_type = excluded.content_type,
        size = excluded.size,
        uploaded_by = coalesce(excluded.uploaded_by, vault_files.uploaded_by),
        updated_at = excluded.updated_at`,
    )
    .bind(
      path,
      teamId,
      JSON.stringify(params.pathTokens),
      params.storageProvider,
      params.storageId,
      params.bucket ?? "vault",
      params.contentType ?? null,
      params.size ?? null,
      params.uploadedBy ?? null,
      timestamp,
      timestamp,
    )
    .run();
}

export async function getVaultFileIndex(pathTokens: string[]) {
  const d1 = getD1();

  if (!d1) {
    return null;
  }

  const row = await d1
    .prepare("select * from vault_files where path = ? limit 1")
    .bind(toPath(pathTokens))
    .first<VaultFileRow>();

  return row ? toVaultFileRecord(row) : null;
}

export async function deleteVaultFileIndex(pathTokens: string[]) {
  const d1 = getD1();

  if (!d1) {
    return;
  }

  await d1.prepare("delete from vault_files where path = ?").bind(toPath(pathTokens)).run();
}
