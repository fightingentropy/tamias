import { createTranslator, getStaticLocaleParams } from "./shared";

export async function getI18n(locale = "en") {
  return createTranslator(locale);
}

export async function getScopedI18n(scope: string, locale = "en") {
  const t = createTranslator(locale);
  return (key: string, params?: Record<string, unknown>) =>
    t(`${scope}.${key}`, params);
}

export function getStaticParams() {
  return getStaticLocaleParams();
}
