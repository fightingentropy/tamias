"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "@/framework/navigation";
import {
  normalizeParser,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  parseAsStringLiteral,
  parseQueryValue,
  type InferParserMap,
  type InferParserValue,
  type QueryStateOptions,
  type QueryStateParser,
  updateQueryString,
} from "./shared";

export {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  parseAsStringLiteral,
};

export function useQueryState<T = string, HasDefault extends boolean = false>(
  key: string,
  parser?: QueryStateParser<T, HasDefault> | (QueryStateOptions & { defaultValue?: T }),
) {
  const searchParams = useSearchParams();
  const normalizedParser = normalizeParser(parser);
  const search = searchParams.toString();
  const query =
    normalizedParser.type === "multi"
      ? searchParams.getAll(key)
      : searchParams.get(key);
  const value = useMemo(
    () => parseQueryValue(normalizedParser, query),
    [normalizedParser, query, search],
  ) as InferParserValue<QueryStateParser<T, HasDefault>>;

  const setValue = useCallback(
    (nextValue: T | null) => {
      updateQueryString({ [key]: nextValue }, { [key]: normalizedParser });
    },
    [key, normalizedParser],
  );

  return [value, setValue] as const;
}

export function useQueryStates<
  TParsers extends Record<string, QueryStateParser<any, any>>,
>(parsers: TParsers, options?: QueryStateOptions) {
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const values = useMemo(() => {
    const result = {} as InferParserMap<TParsers>;

    for (const [key, parser] of Object.entries(parsers)) {
      const query =
        parser.type === "multi"
          ? searchParams.getAll(key)
          : searchParams.get(key);

      (result as Record<string, unknown>)[key] = parseQueryValue(parser, query);
    }

    return result;
  }, [parsers, search, searchParams]);

  const setValues = useCallback(
    (
      nextValues:
        | Partial<{
            [TKey in keyof TParsers]:
              | InferParserValue<TParsers[TKey]>
              | null
              | undefined;
          }>
        | null,
    ) => {
      updateQueryString(nextValues, parsers, options);
    },
    [options, parsers],
  );

  return [values, setValues] as const;
}
