import {
  getInboxItemsByAmountRangeFromConvex,
  searchInboxItemsFromConvex,
} from "../../convex";

export async function getIndexedInboxMatchCandidates(params: {
  teamId: string;
  amount: number | null | undefined;
  searchTerms: Array<string | null | undefined>;
  limit: number;
}) {
  const searchTerms = [
    ...new Set(
      params.searchTerms
        .map((term) => term?.trim())
        .filter((term): term is string => Boolean(term)),
    ),
  ];
  const absoluteAmount = Math.abs(params.amount ?? 0);
  const amountTolerance = Math.max(1, absoluteAmount * 0.35);
  const searchAmount = Math.round(absoluteAmount * 100);
  const searchTolerance = Math.ceil(amountTolerance * 100);
  const [textCandidateGroups, amountCandidates] = await Promise.all([
    Promise.all(
      searchTerms.map((searchTerm) =>
        searchInboxItemsFromConvex({
          teamId: params.teamId,
          query: searchTerm,
          limit: params.limit,
        }),
      ),
    ),
    absoluteAmount > 0
      ? getInboxItemsByAmountRangeFromConvex({
          teamId: params.teamId,
          minAmount: Math.max(0, searchAmount - searchTolerance),
          maxAmount: searchAmount + searchTolerance,
          limit: params.limit,
        })
      : Promise.resolve([]),
  ]);

  return [
    ...new Map(
      [...textCandidateGroups.flat(), ...amountCandidates]
        .filter(
          (item) =>
            item.transactionId == null &&
            item.date !== null &&
            (item.status === "pending" || item.status === "no_match"),
        )
        .map((item) => [item.id, item]),
    ).values(),
  ];
}
