import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
  type DatabaseOrTransaction,
} from "../client";

type BankProvider = "truelayer";

export type InstitutionRecord = {
  id: string;
  name: string;
  logo: string | null;
  popularity: number;
  availableHistory: number | null;
  maximumConsentValidity: number | null;
  provider: BankProvider;
  type: string | null;
  countries: string[];
};

type InstitutionRow = {
  id: string;
  name: string;
  logo: string | null;
  popularity: number;
  available_history: number | null;
  maximum_consent_validity: number | null;
  provider: BankProvider;
  type: string | null;
  countries_json: string;
};

export type GetInstitutionsParams = {
  countryCode: string;
  q?: string;
  limit?: number;
  excludeProviders?: BankProvider[];
};

const excludedInstitutions = new Set(["ins_56"]);

function getInstitutionsD1(db: Database | DatabaseOrTransaction) {
  return requireCloudflareD1Database(db as Database);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseCountries(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;

    if (Array.isArray(parsed)) {
      return parsed.filter((country): country is string => typeof country === "string");
    }
  } catch {
    // Treat malformed stored country data as unavailable for search.
  }

  return [];
}

function serializeInstitution(row: InstitutionRow): InstitutionRecord {
  return {
    id: row.id,
    name: row.name,
    logo: row.logo ?? null,
    popularity: Number(row.popularity),
    availableHistory: row.available_history ?? null,
    maximumConsentValidity: row.maximum_consent_validity ?? null,
    provider: row.provider,
    type: row.type ?? null,
    countries: parseCountries(row.countries_json),
  };
}

function getSearchRank(name: string, queryText: string) {
  const normalizedName = normalizeSearchValue(name);
  const normalizedQuery = normalizeSearchValue(queryText);

  if (!normalizedQuery) {
    return 1;
  }

  if (normalizedName === normalizedQuery) {
    return 5;
  }

  if (normalizedName.startsWith(normalizedQuery)) {
    return 4;
  }

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const containsAllTokens = queryTokens.every((token) => normalizedName.includes(token));

  if (containsAllTokens) {
    return 3;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return 2;
  }

  return 0;
}

async function getInstitutionRows(
  d1: CloudflareD1DatabaseBinding,
  where: string,
  values: unknown[],
) {
  const { results = [] } = await d1
    .prepare(
      `select
        institution_id as id,
        name,
        logo,
        popularity,
        available_history,
        maximum_consent_validity,
        provider,
        type,
        countries_json
      from institutions
      ${where}`,
    )
    .bind(...values)
    .all<InstitutionRow>();

  return results.map(serializeInstitution);
}

export async function getInstitutions(db: Database, params: GetInstitutionsParams) {
  const limit = params.limit ?? 50;
  const hasSearch = !!params.q && params.q !== "*";
  const excludedProviders = new Set(params.excludeProviders ?? []);
  const records = await getInstitutionRows(getInstitutionsD1(db), "where status = 'active'", []);

  return records
    .filter((record) => !excludedInstitutions.has(record.id))
    .filter((record) => record.countries.includes(params.countryCode))
    .filter((record) => !excludedProviders.has(record.provider))
    .map((record) => ({
      record,
      rank: hasSearch ? getSearchRank(record.name, params.q!) : 1,
    }))
    .filter(({ rank }) => !hasSearch || rank > 0)
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return right.rank - left.rank;
      }

      if (left.record.popularity !== right.record.popularity) {
        return right.record.popularity - left.record.popularity;
      }

      return left.record.name.localeCompare(right.record.name);
    })
    .slice(0, limit)
    .map(({ record }) => record);
}

export type GetInstitutionByIdParams = {
  id: string;
};

export async function getInstitutionById(db: Database, params: GetInstitutionByIdParams) {
  const [record] = await getInstitutionRows(
    getInstitutionsD1(db),
    "where institution_id = ? limit 1",
    [params.id],
  );

  return record ?? null;
}

export type UpdateInstitutionUsageParams = {
  id: string;
};

export async function updateInstitutionUsage(db: Database, params: UpdateInstitutionUsageParams) {
  const d1 = getInstitutionsD1(db);
  const existing = await getInstitutionById(db, params);

  if (!existing) {
    return null;
  }

  await d1
    .prepare(
      `update institutions
      set popularity = popularity + 1,
        updated_at = ?
      where institution_id = ?`,
    )
    .bind(nowIso(), params.id)
    .run();

  return getInstitutionById(db, params);
}

// --- Sync operations ---

export type UpsertInstitutionData = {
  id: string;
  name: string;
  logo: string | null;
  provider: "truelayer";
  countries: string[];
  availableHistory: number | null;
  maximumConsentValidity: number | null;
  popularity: number;
  type: string | null;
};

export async function upsertInstitutions(
  db: DatabaseOrTransaction,
  data: UpsertInstitutionData[],
  batchSize = 500,
): Promise<number> {
  if (data.length === 0) {
    return 0;
  }

  let total = 0;
  const d1 = getInstitutionsD1(db);
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const timestamp = nowIso();
    const statements = batch.map((institution) =>
      d1
        .prepare(
          `insert into institutions (
            institution_id,
            name,
            normalized_name,
            logo,
            provider,
            countries_json,
            available_history,
            maximum_consent_validity,
            popularity,
            type,
            status,
            created_at,
            updated_at
          ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
          on conflict(institution_id) do update set
            name = excluded.name,
            normalized_name = excluded.normalized_name,
            logo = excluded.logo,
            provider = excluded.provider,
            countries_json = excluded.countries_json,
            available_history = excluded.available_history,
            maximum_consent_validity = excluded.maximum_consent_validity,
            type = excluded.type,
            status = 'active',
            updated_at = excluded.updated_at`,
        )
        .bind(
          institution.id,
          institution.name,
          normalizeSearchValue(institution.name),
          institution.logo,
          institution.provider,
          JSON.stringify(institution.countries),
          institution.availableHistory,
          institution.maximumConsentValidity,
          institution.popularity,
          institution.type,
          timestamp,
          timestamp,
        ),
    );

    await d1.batch(statements);
    total += batch.length;
  }

  return total;
}

export async function getActiveInstitutionIds(
  db: DatabaseOrTransaction,
  providers?: BankProvider[],
): Promise<string[]> {
  const values: unknown[] = [];
  let where = "where status = 'active'";

  if (providers?.length) {
    const placeholders = providers.map(() => "?").join(", ");
    where += ` and provider in (${placeholders})`;
    values.push(...providers);
  }

  const { results = [] } = await getInstitutionsD1(db)
    .prepare(`select institution_id from institutions ${where}`)
    .bind(...values)
    .all<{ institution_id: string }>();

  return results.map((row) => row.institution_id);
}

export async function markInstitutionsRemoved(
  db: DatabaseOrTransaction,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  const d1 = getInstitutionsD1(db);
  const timestamp = nowIso();
  let updated = 0;

  for (const id of ids) {
    const existing = await d1
      .prepare("select status from institutions where institution_id = ? limit 1")
      .bind(id)
      .first<{ status: string }>();

    if (!existing || existing.status === "removed") {
      continue;
    }

    await d1
      .prepare("update institutions set status = 'removed', updated_at = ? where institution_id = ?")
      .bind(timestamp, id)
      .run();
    updated += 1;
  }

  return updated;
}
