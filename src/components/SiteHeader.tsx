"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GENDERS, genderOfPath } from "@/domain/gender";
import { rememberLocale, useLang } from "@/i18n/client";
import { href } from "@/i18n/format";
import { localePath, splitLocale, type Locale } from "@/i18n/locales";
import { FavoritesLink } from "./FavoritesLink";

const LANG_LABEL: Record<Locale, string> = { zh: "中", en: "EN" };

/** Site header; search and deals follow the section (women / men) and language the visitor is in. */
export function SiteHeader() {
  const { lang, t } = useLang();
  const router = useRouter();
  const { path } = splitLocale(usePathname());
  const gender = genderOfPath(path);

  function switchTo(next: Locale) {
    if (next === lang) return;
    rememberLocale(next);
    router.push(`${localePath(next, path)}${window.location.search}`);
  }

  const sections = (
    <>
      {GENDERS.map((g) => (
        <Link
          key={g}
          href={href(lang, g, "/")}
          aria-current={g === gender ? "page" : undefined}
          className={g === gender ? "text-ink font-medium underline underline-offset-[6px] decoration-2" : "text-ink-soft hover:text-ink"}
        >
          {t.gender[g]}
        </Link>
      ))}
      <Link href={href(lang, gender, "/deals")} className="text-madder hover:underline underline-offset-4 decoration-1">{t.header.deals}</Link>
    </>
  );

  return (
    <header className="border-b border-rule/80 bg-cloth/85 backdrop-blur-sm sticky top-0 z-30">
      <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6 h-14 flex items-center gap-3 sm:gap-6">
        <Link href={href(lang, gender, "/")} className="flex items-baseline gap-2 shrink-0">
          <span className="font-display text-xl sm:text-2xl leading-none tracking-tight">ShoppingSaver</span>
          <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">{gender} · us</span>
        </Link>
        <form action={href(lang, gender, "/search")} role="search" className="ml-auto hidden sm:block">
          <input
            name="q"
            placeholder={t.header.searchPlaceholder}
            aria-label={t.header.searchLabel(t.gender[gender])}
            className="w-56 lg:w-72 border border-rule bg-paper/80 px-3 py-1.5 text-sm focus:outline-none focus:border-ink"
          />
        </form>
        <nav className="ml-auto sm:ml-0 flex items-center gap-4 sm:gap-5 text-sm whitespace-nowrap">
          <Link href={href(lang, gender, "/search")} className="sm:hidden text-ink-soft hover:text-ink" aria-label={t.header.search}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
          </Link>
          <div className="hidden sm:flex items-center gap-5" aria-label={t.header.section}>{sections}</div>
          <FavoritesLink />
          <div role="group" aria-label={t.header.language} className="flex items-center text-xs border border-rule">
            {(["zh", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => switchTo(l)}
                aria-pressed={l === lang}
                lang={l === "zh" ? "zh-Hant" : "en"}
                className={`px-2 py-1 ${l === lang ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"}`}
              >
                {LANG_LABEL[l]}
              </button>
            ))}
          </div>
        </nav>
      </div>
      {/* Phones: the section tabs get their own row so the top row never overflows. */}
      <div className="sm:hidden border-t border-rule/60 px-4 h-10 flex items-center gap-5 text-sm" aria-label={t.header.section}>
        {sections}
      </div>
    </header>
  );
}
