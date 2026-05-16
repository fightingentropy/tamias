import type { getTeamMembers } from "../../teams/reads";
import type { TransactionCategoryRecord } from "../../transaction-categories/d1";
import type {
  AssignedTransactionUser,
  TransactionAttachmentSummary,
  TransactionRecord,
  TransactionTag,
  TransactionTagAssignmentRecord,
} from "./types";

export function buildAssignedTransactionUser(member: AssignedTransactionUser | undefined) {
  return {
    id: member?.id ?? null,
    fullName: member?.fullName ?? null,
    avatarUrl: member?.avatarUrl ?? null,
  };
}

export function buildAssignedUserLookup(
  teamMembers: Awaited<ReturnType<typeof getTeamMembers>>,
) {
  return new Map<string, AssignedTransactionUser>(
    teamMembers.map((member) => [
      member.id,
      {
        id: member.id,
        fullName: member.fullName,
        avatarUrl: member.avatarUrl,
      },
    ]),
  );
}

function sortTransactionTags<T extends { tag: { name: string } }>(left: T, right: T) {
  return left.tag.name.localeCompare(right.tag.name);
}

export function buildTransactionTagLookups(assignments: TransactionTagAssignmentRecord[]) {
  const assignmentsByTransactionId = new Map<string, TransactionTagAssignmentRecord[]>();
  const tagsByTransactionId = new Map<string, TransactionTag[]>();

  for (const assignment of assignments) {
    const currentAssignments = assignmentsByTransactionId.get(assignment.transactionId) ?? [];
    currentAssignments.push(assignment);
    currentAssignments.sort(sortTransactionTags);
    assignmentsByTransactionId.set(assignment.transactionId, currentAssignments);

    const currentTags = tagsByTransactionId.get(assignment.transactionId) ?? [];

    currentTags.push({
      id: assignment.tag.id,
      name: assignment.tag.name,
    });
    currentTags.sort((left, right) => (left.name ?? "").localeCompare(right.name ?? ""));
    tagsByTransactionId.set(assignment.transactionId, currentTags);
  }

  return {
    assignmentsByTransactionId,
    tagsByTransactionId,
  };
}

export function expandTransactionCategories(
  categoriesBySlug: Map<string, TransactionCategoryRecord>,
  categoriesById: Map<string, TransactionCategoryRecord>,
  filterCategories: string[],
) {
  const expandedSlugs = new Set(filterCategories.filter((slug) => slug !== "uncategorized"));

  for (const slug of expandedSlugs) {
    const category = categoriesBySlug.get(slug);

    if (!category || category.parentId) {
      continue;
    }

    for (const child of categoriesById.values()) {
      if (child.parentId === category.id) {
        expandedSlugs.add(child.slug);
      }
    }
  }

  return expandedSlugs;
}

export function buildTransactionAttachmentLookups(
  attachments: Array<{
    id: string;
    transactionId: string | null;
    name: string | null;
    path: string[] | null;
    type: string | null;
    size: number | null;
  }>,
) {
  const attachmentsByTransactionId = new Map<string, TransactionAttachmentSummary[]>();

  for (const attachment of attachments) {
    if (!attachment.transactionId) {
      continue;
    }

    const current = attachmentsByTransactionId.get(attachment.transactionId) ?? [];
    current.push({
      id: attachment.id,
      name: attachment.name,
      path: attachment.path,
      type: attachment.type,
      size: attachment.size,
    });
    attachmentsByTransactionId.set(attachment.transactionId, current);
  }

  return {
    attachmentsByTransactionId,
  };
}
