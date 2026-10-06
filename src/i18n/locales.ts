/**
 * Site languages. Chinese keeps the original unprefixed URLs (/, /g/tops, /men…);
 * English lives under /en. Internally every page sits under app/[lang], and
 * src/proxy.ts rewrites unprefixed URLs to /zh.
 */
export const LOCALES = ["zh", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "zh";
/** Remembers an explicit choice from the language switch. */
export const LOCALE_COOKIE = "lang";

export const HTML_LANG: Record<Locale, string> = { zh: "zh-Hant", en: "en" };

export function isLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v);
}

/** Public URL of a site path in a language: localePath("en", "/men/g/tops") → "/en/men/g/tops". */
export function localePath(lang: Locale, path: string): string {
  if (lang === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${lang}` : `/${lang}${path}`;
}

/** Split a public pathname into its language and the language-free path. */
export function splitLocale(pathname: string): { lang: Locale; path: string } {
  const m = pathname.match(/^\/(en|zh)(?=\/|$)/);
  if (!m) return { lang: DEFAULT_LOCALE, path: pathname || "/" };
  return { lang: m[1] as Locale, path: pathname.slice(m[0].length) || "/" };
}
