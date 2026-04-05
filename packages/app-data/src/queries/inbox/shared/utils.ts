export function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function compareNullableStrings(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  return normalizeText(left).localeCompare(normalizeText(right));
}

export function compareNullableNumbers(
  left: number | null | undefined,
  right: number | null | undefined,
) {
  return (left ?? 0) - (right ?? 0);
}

export function compareNullableDates(
  left: string | null | undefined,
  right: string | null | undefined,
  direction: "asc" | "desc",
) {
  const leftValue = left ?? (direction === "asc" ? "" : "\uffff");
  const rightValue = right ?? (direction === "asc" ? "" : "\uffff");
  return leftValue.localeCompare(rightValue);
}

export function includesSearch(
  value: string | null | undefined,
  query: string,
) {
  return normalizeText(value).includes(normalizeText(query));
}

export function filePathEquals(
  left: string[] | null | undefined,
  right: string[],
) {
  if (!left || left.length !== right.length) {
    return false;
  }

  return left.every((token, index) => token === right[index]);
}

export function shiftIsoDate(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}
