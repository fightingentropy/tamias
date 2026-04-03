import {
  docEntries,
  type DocMetadata,
  type DocMetadataEntry,
} from "@/site/generated/doc-metadata";

export type { DocMetadata, DocMetadataEntry };

export function getDocMetadataBySlug(slug: string) {
  return docEntries.find((doc) => doc.slug === slug) ?? null;
}

export function getAllDocSlugs(): string[] {
  return docEntries.map((doc) => doc.slug);
}
