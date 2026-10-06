import { notFound } from "next/navigation";
import { lang as langParam } from "next/root-params";
import { getDict, type Dict } from "./dict";
import { isLocale, type Locale } from "./locales";

/** The current page's language (the app/[lang] root segment), for Server Components. */
export async function getLang(): Promise<{ lang: Locale; t: Dict }> {
  const lang = await langParam();
  if (!isLocale(lang)) notFound();
  return { lang, t: getDict(lang) };
}
