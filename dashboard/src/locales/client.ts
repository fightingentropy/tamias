"use client";

import { createElement, createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, getStaticLocaleParams, languages, type Locale } from "./shared";

type I18nContextValue = {
  locale: Locale;
  t: ReturnType<typeof createTranslator>;
};

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  t: createTranslator("en"),
});

type ProviderProps = {
  locale: string;
  children: ReactNode;
};

export function I18nProviderClient({ locale, children }: ProviderProps) {
  const resolvedLocale = (languages.includes(locale as Locale) ? locale : "en") as Locale;

  const value = useMemo(
    () => ({
      locale: resolvedLocale,
      t: createTranslator(resolvedLocale),
    }),
    [resolvedLocale],
  );

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  return useContext(I18nContext).t;
}

export function useScopedI18n(scope: string) {
  const t = useI18n();
  return (key: string, params?: Record<string, unknown>) => t(`${scope}.${key}`, params);
}

export function useCurrentLocale() {
  return useContext(I18nContext).locale;
}

export function useChangeLocale() {
  return () => {
    throw new Error("Changing locales is not implemented in the TanStack migration path.");
  };
}

export { languages };
export const getStaticParams = getStaticLocaleParams;
