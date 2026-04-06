import {
  CATEGORIES,
  CONTRA_REVENUE_CATEGORIES,
  REVENUE_CATEGORIES,
  getCategoryBySlug,
  getCategoryColor,
  getTaxRateForCategory,
  getTaxTypeForCountry,
} from "@tamias/categories";
import type { TransactionRecord } from "@tamias/app-data-convex";

export type CategoryInfo = {
  slug: string;
  name: string;
  color: string;
  excluded: boolean;
  parentSlug: string | null;
  system: boolean;
  taxRate: number | null;
  taxType: string | null;
};

const categoryLookupCache = new Map<string, Map<string, CategoryInfo>>();

export function humanizeCategorySlug(slug: string) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getCategoryLookup(countryCode: string | null) {
  const cacheKey = countryCode ?? "";
  const cached = categoryLookupCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const lookup = new Map<string, CategoryInfo>();
  const taxType = countryCode ? getTaxTypeForCountry(countryCode) : null;

  for (const parent of CATEGORIES) {
    const parentTaxRate = countryCode ? getTaxRateForCategory(countryCode, parent.slug) : 0;
    lookup.set(parent.slug, {
      slug: parent.slug,
      name: parent.name,
      color: parent.color ?? getCategoryColor(parent.slug),
      excluded: parent.excluded ?? false,
      parentSlug: null,
      system: parent.system,
      taxRate: parentTaxRate > 0 ? parentTaxRate : null,
      taxType: parentTaxRate > 0 ? taxType : null,
    });

    for (const child of parent.children) {
      const childTaxRate = countryCode ? getTaxRateForCategory(countryCode, child.slug) : 0;
      lookup.set(child.slug, {
        slug: child.slug,
        name: child.name,
        color: child.color ?? getCategoryColor(child.slug),
        excluded: child.excluded ?? false,
        parentSlug: parent.slug,
        system: child.system,
        taxRate: childTaxRate > 0 ? childTaxRate : null,
        taxType: childTaxRate > 0 ? taxType : null,
      });
    }
  }

  categoryLookupCache.set(cacheKey, lookup);
  return lookup;
}

export function getCategoryInfo(slug: string | null, countryCode: string | null) {
  if (!slug) {
    return null;
  }

  const lookup = getCategoryLookup(countryCode);
  const info = lookup.get(slug);
  if (info) {
    return info;
  }

  return {
    slug,
    name: humanizeCategorySlug(slug),
    color: getCategoryColor(slug),
    excluded: false,
    parentSlug: null,
    system: false,
    taxRate: null,
    taxType: null,
  };
}

export function getExcludedCategorySlugs() {
  return CATEGORIES.flatMap((parent) =>
    parent.children.filter((child) => child.excluded).map((child) => child.slug),
  );
}

export function getCogsCategorySlugsFromStaticTaxonomy() {
  const cogsParent = getCategoryBySlug("cost-of-goods-sold");
  if (!cogsParent || !("children" in cogsParent)) {
    return [];
  }

  return cogsParent.children.filter((child) => !child.excluded).map((child) => child.slug);
}

export function getResolvedTransactionTaxRate(
  transaction: TransactionRecord,
  countryCode: string | null,
) {
  return (
    transaction.taxRate ?? getCategoryInfo(transaction.categorySlug, countryCode)?.taxRate ?? 0
  );
}

export function getResolvedTransactionTaxType(
  transaction: TransactionRecord,
  countryCode: string | null,
) {
  return transaction.taxType ?? (countryCode ? getTaxTypeForCountry(countryCode) : null);
}

export { CONTRA_REVENUE_CATEGORIES, REVENUE_CATEGORIES };
