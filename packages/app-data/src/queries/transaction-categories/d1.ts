import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../../client";

export type TransactionCategoryRecord = {
  id: string;
  teamId: string;
  name: string;
  color: string | null;
  slug: string;
  description: string | null;
  system: boolean;
  taxRate: number | null;
  taxType: string | null;
  taxReportingCode: string | null;
  excluded: boolean;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

type TransactionCategoryRow = {
  id: string;
  team_id: string;
  name: string;
  color: string | null;
  slug: string;
  description: string | null;
  system: number;
  tax_rate: number | null;
  tax_type: string | null;
  tax_reporting_code: string | null;
  excluded: number;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
};

export type UpsertTransactionCategoryInput = {
  id?: string;
  teamId: string;
  name: string;
  slug?: string;
  color?: string | null;
  description?: string | null;
  system?: boolean;
  taxRate?: number | null;
  taxType?: string | null;
  taxReportingCode?: string | null;
  excluded?: boolean | null;
  parentId?: string | null;
};

function requireTransactionCategoriesD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function slugifyCategoryName(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "category"
  );
}

function toTransactionCategoryRecord(row: TransactionCategoryRow): TransactionCategoryRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    color: row.color,
    slug: row.slug,
    description: row.description,
    system: row.system === 1,
    taxRate: row.tax_rate,
    taxType: row.tax_type,
    taxReportingCode: row.tax_reporting_code,
    excluded: row.excluded === 1,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getTransactionCategoryBySlugFromD1(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    slug: string;
  },
) {
  const row = await d1
    .prepare("select * from transaction_categories where team_id = ? and slug = ? limit 1")
    .bind(args.teamId, args.slug)
    .first<TransactionCategoryRow>();

  return row ? toTransactionCategoryRecord(row) : null;
}

async function findUniqueSlug(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    baseSlug: string;
    excludeCategoryId?: string;
  },
) {
  const rootSlug = args.baseSlug || "category";
  let slug = rootSlug;
  let counter = 1;

  while (true) {
    const existing = await getTransactionCategoryBySlugFromD1(d1, {
      teamId: args.teamId,
      slug,
    });

    if (!existing || existing.id === args.excludeCategoryId) {
      return slug;
    }

    slug = `${rootSlug}-${counter}`;
    counter += 1;
  }
}

async function getExistingTransactionCategory(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    id?: string;
    slug?: string;
  },
) {
  if (args.id) {
    const byId = await getTransactionCategoryRecordById(d1, {
      teamId: args.teamId,
      id: args.id,
    });

    if (byId) {
      return byId;
    }
  }

  if (args.slug) {
    return getTransactionCategoryBySlugFromD1(d1, {
      teamId: args.teamId,
      slug: args.slug,
    });
  }

  return null;
}

async function resolveParentId(
  d1: CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    parentId?: string | null;
  },
) {
  if (args.parentId === undefined || args.parentId === null) {
    return args.parentId ?? null;
  }

  const parent = await getTransactionCategoryRecordById(d1, {
    teamId: args.teamId,
    id: args.parentId,
  });

  if (!parent) {
    throw new Error("Parent transaction category not found");
  }

  return parent.id;
}

export async function listTransactionCategoryRecords(db: Database, teamId: string) {
  const d1 = requireTransactionCategoriesD1(db);
  const result = await d1
    .prepare(
      `select *
       from transaction_categories
       where team_id = ?
       order by system desc, name asc`,
    )
    .bind(teamId)
    .all<TransactionCategoryRow>();

  return (result.results ?? []).map(toTransactionCategoryRecord);
}

export async function getTransactionCategoryRecordById(
  dbOrD1: Database | CloudflareD1DatabaseBinding,
  args: {
    teamId: string;
    id: string;
  },
) {
  const d1 = "prepare" in dbOrD1 ? dbOrD1 : requireTransactionCategoriesD1(dbOrD1);
  const row = await d1
    .prepare("select * from transaction_categories where team_id = ? and id = ? limit 1")
    .bind(args.teamId, args.id)
    .first<TransactionCategoryRow>();

  return row ? toTransactionCategoryRecord(row) : null;
}

export async function upsertTransactionCategoryRecord(
  db: Database,
  args: UpsertTransactionCategoryInput,
) {
  const d1 = requireTransactionCategoriesD1(db);
  const existing = await getExistingTransactionCategory(d1, {
    teamId: args.teamId,
    id: args.id,
    slug: args.slug,
  });
  const parentId = await resolveParentId(d1, {
    teamId: args.teamId,
    parentId: args.parentId,
  });
  const timestamp = new Date().toISOString();

  if (existing) {
    if (args.parentId !== undefined && args.parentId !== existing.parentId) {
      const child = await d1
        .prepare(
          `select id
           from transaction_categories
           where team_id = ? and parent_id = ?
           limit 1`,
        )
        .bind(args.teamId, existing.id)
        .first<{ id: string }>();

      if (child) {
        throw new Error("Cannot change parent of a category that has children");
      }
    }

    const nextSlug =
      args.slug === undefined
        ? existing.slug
        : await findUniqueSlug(d1, {
            teamId: args.teamId,
            baseSlug: slugifyCategoryName(args.slug),
            excludeCategoryId: existing.id,
          });

    await d1
      .prepare(
        `update transaction_categories
         set name = ?,
             color = ?,
             slug = ?,
             description = ?,
             system = ?,
             tax_rate = ?,
             tax_type = ?,
             tax_reporting_code = ?,
             excluded = ?,
             parent_id = ?,
             updated_at = ?
         where id = ? and team_id = ?`,
      )
      .bind(
        args.name,
        args.color ?? null,
        nextSlug,
        args.description ?? null,
        args.system === undefined ? (existing.system ? 1 : 0) : args.system ? 1 : 0,
        args.taxRate ?? null,
        args.taxType ?? null,
        args.taxReportingCode ?? null,
        args.excluded === undefined ? (existing.excluded ? 1 : 0) : args.excluded ? 1 : 0,
        args.parentId === undefined ? existing.parentId : parentId,
        timestamp,
        existing.id,
        args.teamId,
      )
      .run();

    const updated = await getTransactionCategoryRecordById(d1, {
      teamId: args.teamId,
      id: existing.id,
    });

    if (!updated) {
      throw new Error("Failed to update transaction category");
    }

    return updated;
  }

  const id = args.id ?? crypto.randomUUID();
  const slug = await findUniqueSlug(d1, {
    teamId: args.teamId,
    baseSlug: slugifyCategoryName(args.slug ?? args.name),
  });

  await d1
    .prepare(
      `insert into transaction_categories (
        id,
        team_id,
        name,
        color,
        slug,
        description,
        system,
        tax_rate,
        tax_type,
        tax_reporting_code,
        excluded,
        parent_id,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      args.teamId,
      args.name,
      args.color ?? null,
      slug,
      args.description ?? null,
      args.system ? 1 : 0,
      args.taxRate ?? null,
      args.taxType ?? null,
      args.taxReportingCode ?? null,
      args.excluded ? 1 : 0,
      parentId,
      timestamp,
      timestamp,
    )
    .run();

  const inserted = await getTransactionCategoryRecordById(d1, {
    teamId: args.teamId,
    id,
  });

  if (!inserted) {
    throw new Error("Failed to create transaction category");
  }

  return inserted;
}

export async function deleteTransactionCategoryRecord(
  db: Database,
  args: {
    teamId: string;
    id: string;
  },
) {
  const d1 = requireTransactionCategoriesD1(db);
  const category = await getTransactionCategoryRecordById(d1, args);

  if (!category || category.system) {
    return null;
  }

  const timestamp = new Date().toISOString();
  await d1
    .prepare(
      `update transaction_categories
       set parent_id = null,
           updated_at = ?
       where team_id = ? and parent_id = ?`,
    )
    .bind(timestamp, args.teamId, category.id)
    .run();
  await d1
    .prepare("delete from transaction_categories where team_id = ? and id = ?")
    .bind(args.teamId, args.id)
    .run();

  return { id: category.id };
}

export async function upsertTransactionCategoryRecords(
  db: Database,
  args: {
    teamId: string;
    categories: UpsertTransactionCategoryInput[];
  },
) {
  const results: TransactionCategoryRecord[] = [];

  for (const category of args.categories) {
    results.push(
      await upsertTransactionCategoryRecord(db, {
        ...category,
        teamId: args.teamId,
      }),
    );
  }

  return results;
}
