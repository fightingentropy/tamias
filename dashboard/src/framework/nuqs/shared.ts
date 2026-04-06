export type SearchParams = Record<string, string | string[] | undefined>;

export type QueryHistoryMode = "push" | "replace";

export type QueryStateOptions = {
  clearOnDefault?: boolean;
  history?: QueryHistoryMode;
  startTransition?: (callback: () => void) => void;
};

type EqualityComparator<T> = (a: T, b: T) => boolean;

export interface QueryStateParser<T, HasDefault extends boolean = false> extends QueryStateOptions {
  defaultValue?: HasDefault extends true ? T : undefined;
  eq?: EqualityComparator<T>;
  parse: (value: unknown) => T | null;
  serialize: (value: T) => string | string[];
  type: "single" | "multi";
  withDefault(defaultValue: T): QueryStateParser<T, true>;
  withOptions(options: QueryStateOptions): QueryStateParser<T, HasDefault>;
}

type ParserDefinition<T, HasDefault extends boolean> = Omit<
  QueryStateParser<T, HasDefault>,
  "withDefault" | "withOptions"
>;

function createConfiguredParser<T, HasDefault extends boolean>(
  definition: ParserDefinition<T, HasDefault>,
): QueryStateParser<T, HasDefault> {
  return {
    ...definition,
    withDefault(defaultValue: T) {
      return createConfiguredParser<T, true>({
        ...definition,
        defaultValue,
      });
    },
    withOptions(options: QueryStateOptions) {
      return createConfiguredParser<T, HasDefault>({
        ...definition,
        ...options,
      });
    },
  };
}

function createParser<T>(definition: {
  eq?: EqualityComparator<T>;
  parse: (value: string) => T | null;
  serialize: (value: T) => string;
}): QueryStateParser<T, false> {
  return createConfiguredParser<T, false>({
    eq: definition.eq,
    parse: (value) => (typeof value === "string" ? definition.parse(value) : null),
    serialize: definition.serialize,
    type: "single",
  });
}

function safeParse<T>(parser: (value: unknown) => T | null, value: unknown) {
  try {
    return parser(value);
  } catch {
    return null;
  }
}

function isParser(value: unknown): value is QueryStateParser<unknown, boolean> {
  return (
    typeof value === "object" &&
    value !== null &&
    "parse" in value &&
    "serialize" in value &&
    "type" in value
  );
}

function serializeItem(value: string | string[]) {
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

export const parseAsString = createParser<string>({
  parse: (value) => value,
  serialize: String,
});

export const parseAsInteger = createParser<number>({
  parse: (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  },
  serialize: (value) => `${Math.round(value)}`,
});

export const parseAsBoolean = createParser<boolean>({
  parse: (value) => value.toLowerCase() === "true",
  serialize: String,
});

export function parseAsStringLiteral<const TValues extends readonly string[]>(values: TValues) {
  return createParser<TValues[number]>({
    parse: (value) =>
      values.includes(value as TValues[number]) ? (value as TValues[number]) : null,
    serialize: String,
  });
}

export function parseAsStringEnum<const TValues extends readonly string[]>(values: TValues) {
  return parseAsStringLiteral(values);
}

export function parseAsArrayOf<T>(itemParser: QueryStateParser<T, boolean>, separator = ",") {
  const encodedSeparator = encodeURIComponent(separator);

  return createConfiguredParser<T[], false>({
    defaultValue: undefined,
    eq: (left, right) =>
      left.length === right.length &&
      left.every((value, index) => {
        const comparator = itemParser.eq ?? ((a: T, b: T) => Object.is(a, b));

        return comparator(value, right[index] as T);
      }),
    parse: (value) => {
      if (typeof value !== "string") {
        return null;
      }

      if (value === "") {
        return [];
      }

      return value
        .split(separator)
        .map((item) => safeParse(itemParser.parse, item.replaceAll(encodedSeparator, separator)))
        .filter((item): item is T => item !== null);
    },
    serialize: (value) =>
      value
        .map((item) =>
          serializeItem(itemParser.serialize(item)).replaceAll(separator, encodedSeparator),
        )
        .join(separator),
    type: "single",
  });
}

function extractSearchParams(input: unknown) {
  try {
    if (input instanceof Request) {
      return input.url ? new URL(input.url).searchParams : new URLSearchParams();
    }

    if (input instanceof URL) {
      return input.searchParams;
    }

    if (input instanceof URLSearchParams) {
      return input;
    }

    if (typeof input === "object" && input !== null) {
      const searchParams = new URLSearchParams();

      for (const [key, value] of Object.entries(input as SearchParams)) {
        if (Array.isArray(value)) {
          for (const entry of value) {
            searchParams.append(key, entry);
          }
        } else if (value !== undefined) {
          searchParams.set(key, value);
        }
      }

      return searchParams;
    }

    if (typeof input === "string") {
      if (typeof URL.canParse === "function" && URL.canParse(input)) {
        return new URL(input).searchParams;
      }

      return new URLSearchParams(input);
    }
  } catch {
    return new URLSearchParams();
  }

  return new URLSearchParams();
}

function isAbsentFromUrl(query: string | string[] | null) {
  return query === null || (Array.isArray(query) && query.length === 0);
}

export type InferParserValue<TParser> =
  TParser extends QueryStateParser<infer TValue, infer HasDefault>
    ? HasDefault extends true
      ? TValue
      : TValue | null
    : never;

export type InferParserMap<TParsers extends Record<string, QueryStateParser<any, any>>> = {
  [TKey in keyof TParsers]: InferParserValue<TParsers[TKey]>;
};

export function parseQueryValue<T, HasDefault extends boolean>(
  parser: QueryStateParser<T, HasDefault>,
  query: string | string[] | null,
): InferParserValue<QueryStateParser<T, HasDefault>> {
  if (isAbsentFromUrl(query)) {
    return (parser.defaultValue ?? null) as unknown as InferParserValue<
      QueryStateParser<T, HasDefault>
    >;
  }

  const parsed = safeParse(parser.parse, query);

  return (parsed ?? parser.defaultValue ?? null) as unknown as InferParserValue<
    QueryStateParser<T, HasDefault>
  >;
}

export function createLoader<TParsers extends Record<string, QueryStateParser<any, any>>>(
  parsers: TParsers,
) {
  return (input: unknown): InferParserMap<TParsers> => {
    const searchParams = extractSearchParams(input);
    const result = {} as InferParserMap<TParsers>;

    for (const [key, parser] of Object.entries(parsers)) {
      const query = parser.type === "multi" ? searchParams.getAll(key) : searchParams.get(key);

      (result as Record<string, unknown>)[key] = parseQueryValue(
        parser as QueryStateParser<unknown, boolean>,
        query,
      );
    }

    return result;
  };
}

function writeSearchParam(
  searchParams: URLSearchParams,
  key: string,
  serialized: string | string[],
) {
  if (typeof serialized === "string") {
    searchParams.set(key, serialized);
    return;
  }

  searchParams.delete(key);

  for (const value of serialized) {
    searchParams.append(key, value);
  }

  if (!searchParams.has(key)) {
    searchParams.set(key, "");
  }
}

export function normalizeParser<T>(
  parser: QueryStateParser<T, boolean> | QueryStateOptions | undefined,
): QueryStateParser<T, boolean> {
  if (isParser(parser)) {
    return parser as QueryStateParser<T, boolean>;
  }

  let normalized = parseAsString as unknown as QueryStateParser<T, boolean>;

  if (parser && "defaultValue" in parser) {
    const defaultValue = (parser as QueryStateOptions & { defaultValue?: T }).defaultValue;

    if (defaultValue !== undefined) {
      normalized = normalized.withDefault(defaultValue);
    }
  }

  if (parser) {
    normalized = normalized.withOptions(parser);
  }

  return normalized;
}

export function updateQueryString<TParsers extends Record<string, QueryStateParser<any, any>>>(
  updates: Partial<{
    [TKey in keyof TParsers]: InferParserValue<TParsers[TKey]> | null | undefined;
  }> | null,
  parsers: TParsers,
  options?: QueryStateOptions,
) {
  if (typeof window === "undefined") {
    return;
  }

  const searchParams = new URLSearchParams(window.location.search);

  if (updates === null) {
    for (const key of Object.keys(parsers)) {
      searchParams.delete(key);
    }
  } else {
    for (const [key, parser] of Object.entries(parsers)) {
      const value = updates[key as keyof TParsers];

      if (value === undefined) {
        continue;
      }

      const hasDefault = parser.defaultValue !== undefined;
      const matchesDefault =
        hasDefault &&
        value !== null &&
        (parser.eq ?? ((left: unknown, right: unknown) => Object.is(left, right)))(
          value,
          parser.defaultValue,
        );
      const clearOnDefault = parser.clearOnDefault ?? options?.clearOnDefault ?? true;

      if (value === null || (clearOnDefault && matchesDefault)) {
        searchParams.delete(key);
        continue;
      }

      writeSearchParam(searchParams, key, parser.serialize(value) as string | string[]);
    }
  }

  const nextSearch = searchParams.toString();
  const nextUrl = `${window.location.pathname}${
    nextSearch ? `?${nextSearch}` : ""
  }${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl === currentUrl) {
    return;
  }

  const historyMode =
    options?.history ??
    Object.values(parsers).find((parser) => parser.history)?.history ??
    "replace";

  const applyUpdate = () => {
    window.history[historyMode === "push" ? "pushState" : "replaceState"]({}, "", nextUrl);
  };

  if (options?.startTransition) {
    options.startTransition(applyUpdate);
    return;
  }

  applyUpdate();
}
