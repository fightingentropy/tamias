import { createLoggerWithContext } from "@tamias/logger";
import {
  getInboxItemsByAmountRangeFromConvex,
  getInboxItemByIdFromConvex,
  getInboxItemsFromConvex,
  getInboxItemsPageFromConvex,
  searchInboxItemsFromConvex,
  getTransactionByIdFromConvex,
  type InboxItemRecord,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import {
  calculateAmountScore as calculateUnifiedAmountScore,
  calculateCurrencyScore as calculateUnifiedCurrencyScore,
  calculateDateScore as calculateUnifiedDateScore,
  calculateNameScore as calculateUnifiedNameScore,
  scoreMatch,
} from "../../utils/transaction-matching";
import { getTransactionIdsWithAttachments } from "../transaction-attachments";
import {
  compareNullableDates,
  includesSearch,
  markInboxItems,
  shiftIsoDate,
} from "./shared";

const logger = createLoggerWithContext("inbox");
const INBOX_SEARCH_PAGE_SIZE = 100;

function isInboxSearchCandidate(item: InboxItemRecord) {
  return (
    item.status !== "deleted" &&
    item.status !== "other" &&
    item.type !== "other" &&
    item.transactionId == null
  );
}

function getInboxAmountSearchWindow(amount: number) {
  const absoluteAmount = Math.abs(amount);
  const tolerance = Math.max(1, absoluteAmount * 0.25);

  return {
    minAmount: Math.max(0, Math.round((absoluteAmount - tolerance) * 100)),
    maxAmount: Math.round((absoluteAmount + tolerance) * 100),
  };
}

async function getIndexedInboxSearchCandidates(args: {
  teamId: string;
  searchTerms: Array<string | null | undefined>;
  amount?: number | null;
  limit: number;
}) {
  const searchTerms = [
    ...new Set(
      args.searchTerms
        .map((searchTerm) => searchTerm?.trim())
        .filter((searchTerm): searchTerm is string => Boolean(searchTerm)),
    ),
  ];
  const amountWindow =
    args.amount !== null && args.amount !== undefined
      ? getInboxAmountSearchWindow(args.amount)
      : null;
  const [textCandidateGroups, amountCandidates] = await Promise.all([
    Promise.all(
      searchTerms.map((searchTerm) =>
        searchInboxItemsFromConvex({
          teamId: args.teamId,
          query: searchTerm,
          limit: args.limit,
        }),
      ),
    ),
    amountWindow
      ? getInboxItemsByAmountRangeFromConvex({
          teamId: args.teamId,
          minAmount: amountWindow.minAmount,
          maxAmount: amountWindow.maxAmount,
          limit: args.limit,
        })
      : Promise.resolve([]),
  ]);

  return [
    ...new Map(
      [...textCandidateGroups.flat(), ...amountCandidates]
        .filter(isInboxSearchCandidate)
        .map((item) => [item.id, item]),
    ).values(),
  ];
}

async function getRecentInboxSearchItems(teamId: string, limit: number) {
  const results: InboxItemRecord[] = [];
  let cursor: string | null = null;

  while (results.length < limit) {
    const page = await getInboxItemsPageFromConvex({
      teamId,
      cursor,
      pageSize: Math.max(limit, INBOX_SEARCH_PAGE_SIZE),
      order: "desc",
    });

    for (const item of page.page) {
      if (!isInboxSearchCandidate(item)) {
        continue;
      }

      results.push(item);

      if (results.length >= limit) {
        break;
      }
    }

    if (page.isDone || results.length >= limit) {
      return results;
    }

    cursor = page.continueCursor;
  }

  return results;
}

export type GetInboxSearchParams = {
  teamId: string;
  limit?: number;
  q?: string;
  transactionId?: string;
};

export async function getInboxSearch(
  _db: Database,
  params: GetInboxSearchParams,
) {
  try {
    const { teamId, q, transactionId, limit = 10 } = params;

    if (q && q.trim().length > 0) {
      const searchTerm = q.trim();
      const numericSearch = Number.parseFloat(
        searchTerm.replace(/[^\d.-]/g, ""),
      );
      const isNumericSearch =
        !Number.isNaN(numericSearch) && Number.isFinite(numericSearch);
      const candidateLimit = Math.max(limit * 20, 100);
      const searchAmount = Math.round(Math.abs(numericSearch) * 100);
      const searchTolerance = Math.ceil(
        Math.max(1, Math.abs(numericSearch) * 0.1) * 100,
      );
      const [textCandidates, amountCandidates] = await Promise.all([
        searchInboxItemsFromConvex({
          teamId,
          query: searchTerm,
          limit: candidateLimit,
        }),
        isNumericSearch
          ? getInboxItemsByAmountRangeFromConvex({
              teamId,
              minAmount: Math.max(0, searchAmount - searchTolerance),
              maxAmount: searchAmount + searchTolerance,
              limit: candidateLimit,
            })
          : Promise.resolve([]),
      ]);
      const items = [
        ...new Map(
          [...textCandidates, ...amountCandidates]
            .filter(isInboxSearchCandidate)
            .map((item) => [item.id, item]),
        ).values(),
      ];
      const searchResults = items
        .filter((item) => {
          if (isNumericSearch) {
            const tolerance = Math.max(1, Math.abs(numericSearch) * 0.1);
            return (
              includesSearch(item.displayName, searchTerm) ||
              includesSearch(item.fileName, searchTerm) ||
              includesSearch(item.description, searchTerm) ||
              Math.abs((item.amount ?? 0) - numericSearch) <= tolerance
            );
          }

          return (
            includesSearch(item.displayName, searchTerm) ||
            includesSearch(item.fileName, searchTerm) ||
            includesSearch(item.description, searchTerm)
          );
        })
        .sort((left, right) => {
          const dateComparison = compareNullableDates(
            right.date,
            left.date,
            "desc",
          );
          if (dateComparison !== 0) {
            return dateComparison;
          }

          return right.createdAt.localeCompare(left.createdAt);
        })
        .slice(0, limit);

      logger.info("SEARCH RESULTS:", {
        searchTerm,
        resultsCount: searchResults.length,
        results: searchResults.slice(0, 3).map((result) => ({
          id: result.id,
          displayName: result.displayName,
          amount: result.amount,
          currency: result.currency,
        })),
      });

      return searchResults;
    }

    if (transactionId) {
      const transaction = await getTransactionByIdFromConvex({
        teamId,
        transactionId,
      });

      if (transaction) {
        const attachmentCount = (
          await getTransactionIdsWithAttachments({
            teamId,
            transactionIds: [transactionId],
          })
        ).length;

        if (attachmentCount > 0) {
          return [];
        }

        const unifiedTransactionAmount = Math.abs(transaction.amount || 0);
        const unifiedTransactionBaseAmount = Math.abs(
          transaction.baseAmount || 0,
        );
        const dateGte = shiftIsoDate(transaction.date, -123);
        const dateLte = shiftIsoDate(transaction.date, 30);
        const items = await getIndexedInboxSearchCandidates({
          teamId,
          searchTerms: [
            transaction.name,
            transaction.merchantName,
            transaction.counterpartyName,
          ],
          amount: transaction.amount,
          limit: Math.max(limit * 12, 120),
        });

        return items
          .filter((candidate) => candidate.date !== null)
          .filter(
            (candidate) =>
              candidate.date! >= dateGte && candidate.date! <= dateLte,
          )
          .filter((candidate) => {
            const nameScore = calculateUnifiedNameScore(
              candidate.displayName,
              transaction.name,
              transaction.merchantName || transaction.counterpartyName,
            );

            return (
              (candidate.currency === (transaction.currency || "") &&
                Math.abs(
                  Math.abs(candidate.amount ?? 0) - unifiedTransactionAmount,
                ) < Math.max(1, unifiedTransactionAmount * 0.25)) ||
              nameScore > 0.3 ||
              (candidate.baseCurrency === (transaction.baseCurrency || "") &&
                candidate.baseCurrency !== null &&
                Math.abs(
                  Math.abs(candidate.baseAmount ?? 0) -
                    unifiedTransactionBaseAmount,
                ) < Math.max(50, unifiedTransactionBaseAmount * 0.15))
            );
          })
          .map((candidate) => {
            const nameScore = calculateUnifiedNameScore(
              candidate.displayName,
              transaction.name,
              transaction.merchantName || transaction.counterpartyName,
            );
            const amountScore = calculateUnifiedAmountScore(
              candidate,
              transaction,
            );
            const currencyScore = calculateUnifiedCurrencyScore(
              candidate.currency || undefined,
              transaction.currency || undefined,
              candidate.baseCurrency || undefined,
              transaction.baseCurrency || undefined,
            );
            const dateScore = calculateUnifiedDateScore(
              candidate.date!,
              transaction.date,
              candidate.type,
            );
            const isExactAmount =
              candidate.amount !== null &&
              Math.abs(
                Math.abs(candidate.amount || 0) -
                  Math.abs(transaction.amount || 0),
              ) < 0.01;
            const isSameCurrency = candidate.currency === transaction.currency;

            return {
              ...candidate,
              nameScore,
              amountScore,
              currencyScore,
              dateScore,
              confidenceScore: scoreMatch({
                nameScore,
                amountScore,
                dateScore,
                currencyScore,
                isSameCurrency,
                isExactAmount,
              }),
            };
          })
          .filter((candidate) => candidate.confidenceScore >= 0.6)
          .sort((left, right) => right.confidenceScore - left.confidenceScore)
          .slice(0, limit);
      }
    }

    return getRecentInboxSearchItems(teamId, limit);
  } catch (error) {
    logger.error("Error in getInboxSearch:", { error });
    return [];
  }
}

export type FindRelatedInboxItemsParams = {
  inboxId: string;
  teamId: string;
};

export async function findRelatedInboxItems(
  _db: Database,
  params: FindRelatedInboxItemsParams,
) {
  const { inboxId, teamId } = params;
  const currentItem = await getInboxItemByIdFromConvex({
    teamId,
    inboxId,
  });

  if (!currentItem) {
    return [];
  }

  if (currentItem.invoiceNumber) {
    const relatedByInvoiceNumber = (
      await getInboxItemsFromConvex({
        teamId,
        invoiceNumber: currentItem.invoiceNumber,
      })
    ).filter(
      (item) =>
        item.id !== inboxId &&
        item.status !== "deleted" &&
        item.groupedInboxId == null,
    );

    if (relatedByInvoiceNumber.length > 0) {
      return relatedByInvoiceNumber;
    }
  }

  if (
    currentItem.website &&
    currentItem.amount &&
    currentItem.date &&
    (currentItem.type === "invoice" || currentItem.type === "expense")
  ) {
    return (
      await getInboxItemsFromConvex({
        teamId,
        date: currentItem.date,
      })
    ).filter(
      (item) =>
        item.id !== inboxId &&
        item.status !== "deleted" &&
        item.groupedInboxId == null &&
        item.website === currentItem.website &&
        item.amount === currentItem.amount &&
        item.date === currentItem.date &&
        (currentItem.type === "invoice"
          ? item.type === "expense"
          : item.type === "invoice"),
    );
  }

  return [];
}

export type GroupRelatedInboxItemsParams = {
  inboxId: string;
  teamId: string;
};

export async function groupRelatedInboxItems(
  db: Database,
  params: GroupRelatedInboxItemsParams,
) {
  const { inboxId, teamId } = params;
  const relatedItems = await findRelatedInboxItems(db, { inboxId, teamId });

  if (relatedItems.length === 0) {
    return;
  }

  const currentItem = await getInboxItemByIdFromConvex({
    teamId,
    inboxId,
  });

  if (!currentItem) {
    return;
  }

  const allItems = [
    {
      id: currentItem.id,
      type: currentItem.type,
      createdAt: currentItem.createdAt,
    },
    ...relatedItems.map((item) => ({
      id: item.id,
      type: item.type,
      createdAt: item.createdAt,
    })),
  ];

  const primaryItem = allItems.reduce((primary, item) => {
    if (item.type === "invoice" && primary.type !== "invoice") {
      return item;
    }

    if (item.type === primary.type) {
      return new Date(item.createdAt) < new Date(primary.createdAt)
        ? item
        : primary;
    }

    return primary;
  });

  const itemsToUpdate = relatedItems.filter(
    (item) => item.id !== primaryItem.id,
  );

  if (itemsToUpdate.length > 0) {
    await markInboxItems(itemsToUpdate, {
      groupedInboxId: primaryItem.id,
    });

    logger.info("Grouped related inbox items", {
      primaryItemId: primaryItem.id,
      groupedItemIds: itemsToUpdate.map((item) => item.id),
      teamId,
    });
  }
}
