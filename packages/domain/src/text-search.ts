const SEARCH_STOP_WORDS = new Set([
  "and",
  "co",
  "company",
  "corp",
  "corporation",
  "inc",
  "incorporated",
  "llc",
  "limited",
  "ltd",
]);

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeSearchValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return normalizeWhitespace(
    value
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " "),
  );
}

export function tokenizeSearchValue(value: string | null | undefined) {
  return normalizeSearchValue(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 2 &&
        (!/^[a-z]+$/.test(token) || !SEARCH_STOP_WORDS.has(token)),
    );
}

export function buildSearchIndexText(
  values: Array<string | null | undefined>,
) {
  const terms = new Set<string>();

  for (const value of values) {
    const normalized = normalizeSearchValue(value);

    if (normalized.length > 0) {
      terms.add(normalized);
    }

    const tokens = tokenizeSearchValue(value);

    for (const token of tokens) {
      terms.add(token);
    }

    if (tokens.length > 1) {
      terms.add(tokens.join(""));
    }
  }

  return [...terms].join(" ").trim();
}

export function buildSearchQuery(value: string | null | undefined) {
  return buildSearchIndexText([value]);
}

export function buildAbsoluteAmountSearchValue(
  amount: number | null | undefined,
) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return null;
  }

  return Math.round(Math.abs(amount) * 100);
}
