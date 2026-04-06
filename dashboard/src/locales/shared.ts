import en from "./en";

export const languages = ["en"] as const;
export type Locale = (typeof languages)[number];

const dictionaries = {
  en,
} as const;

type DictionaryValue = string | number | boolean | null | undefined | Record<string, unknown>;

function lookupValue(dictionary: Record<string, unknown>, key: string) {
  return key
    .split(".")
    .reduce<DictionaryValue>(
      (current, segment) =>
        current && typeof current === "object"
          ? ((current as Record<string, unknown>)[segment] as DictionaryValue)
          : undefined,
      dictionary,
    );
}

function formatTemplate(template: string, params?: Record<string, unknown>) {
  if (!params) {
    return template;
  }

  return template.replace(/\{([^}]+)\}/g, (_, token: string) => {
    const value = params[token.trim()];
    return value == null ? "" : String(value);
  });
}

export function getDictionary(locale: string) {
  return dictionaries[(locale as Locale) ?? "en"] ?? dictionaries.en;
}

export function createTranslator(locale: string) {
  const dictionary = getDictionary(locale);

  return (key: string, params?: Record<string, unknown>) => {
    const count = typeof params?.count === "number" ? params.count : undefined;
    const segments = key.split(".");
    const lastSegment = segments.at(-1) ?? key;
    const baseSegments = segments.slice(0, -1);
    const pluralKey =
      count == null
        ? null
        : [...baseSegments, `${lastSegment}#${count === 1 ? "one" : "other"}`].join(".");

    const translated =
      (pluralKey ? lookupValue(dictionary, pluralKey) : undefined) ?? lookupValue(dictionary, key);

    if (typeof translated !== "string") {
      return key;
    }

    return formatTemplate(translated, params);
  };
}

export function getStaticLocaleParams() {
  return languages.map((locale) => ({ locale }));
}
