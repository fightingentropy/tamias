import { getInboxItemByIdFromConvex, getInboxItemsFromConvex } from "../../../convex";
import { createLoggerWithContext } from "@tamias/logger";
import type { Database } from "../../../client";
import { markInboxItems } from "../shared";

const logger = createLoggerWithContext("inbox");

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
