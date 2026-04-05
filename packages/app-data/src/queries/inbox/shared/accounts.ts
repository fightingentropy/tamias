import {
  getInboxAccountsByIdsFromConvex,
  type InboxAccountListRecord,
} from "../../../convex";

export function buildInboxAccountMap(accounts: InboxAccountListRecord[]) {
  return new Map(
    accounts.map((account) => [
      account.id,
      {
        id: account.id,
        email: account.email,
        provider: account.provider,
      },
    ]),
  );
}

export async function getInboxAccountMap(
  inboxAccountIds: Array<string | null | undefined>,
) {
  const uniqueIds = [...new Set(inboxAccountIds.filter(Boolean))] as string[];

  if (uniqueIds.length === 0) {
    return new Map<
      string,
      { id: string; email: string; provider: "gmail" | "outlook" }
    >();
  }

  const accounts = await getInboxAccountsByIdsFromConvex({
    ids: uniqueIds,
  });

  return buildInboxAccountMap(accounts);
}
