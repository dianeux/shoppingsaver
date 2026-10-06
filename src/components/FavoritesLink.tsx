"use client";

import Link from "next/link";
import { useLang } from "@/i18n/client";
import { localePath } from "@/i18n/locales";
import { useFavorites } from "@/lib/favorites";

export function FavoritesLink() {
  const n = useFavorites().length;
  const { lang, t } = useLang();
  return (
    <Link href={localePath(lang, "/favorites")} className="flex items-center gap-1 text-ink-soft hover:text-ink" aria-label={t.header.favoritesLabel(n)}>
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden className={n ? "text-madder" : ""}>
        <path
          d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"
          fill={n ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      <span className="hidden sm:inline">{t.header.favorites}</span>{n > 0 && <span className="font-mono text-[11px]">{n}</span>}
    </Link>
  );
}
