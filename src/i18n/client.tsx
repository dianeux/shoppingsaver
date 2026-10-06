"use client";

import { createContext, useContext } from "react";
import { getDict, type Dict } from "./dict";
import { LOCALE_COOKIE, type Locale } from "./locales";

const LangContext = createContext<Locale>("zh");

/** Set once in the root layout; client components read the language from here. */
export function LangProvider({ lang, children }: { lang: Locale; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

/** Remember an explicit language choice for a year; the proxy reads it for unprefixed URLs. */
export function rememberLocale(lang: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
}

export function useLang(): { lang: Locale; t: Dict } {
  const lang = useContext(LangContext);
  return { lang, t: getDict(lang) };
}
