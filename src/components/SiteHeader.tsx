"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GENDER_LABEL, GENDERS, genderOfPath, genderPath } from "@/domain/gender";
import { FavoritesLink } from "./FavoritesLink";

/** Site header; search and deals follow the section (女裝 / 男裝) the visitor is in. */
export function SiteHeader() {
  const gender = genderOfPath(usePathname());
  return (
    <header className="border-b border-rule/80 bg-cloth/85 backdrop-blur-sm sticky top-0 z-30">
      <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6 h-14 flex items-center gap-6">
        <Link href={genderPath(gender, "/")} className="flex items-baseline gap-2 shrink-0">
          <span className="font-display text-2xl leading-none tracking-tight">ShoppingSaver</span>
          <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">{gender} · us</span>
        </Link>
        <form action={genderPath(gender, "/search")} role="search" className="ml-auto hidden sm:block">
          <input
            name="q"
            placeholder="搜尋：低胸 T恤、寬褲 亞麻…"
            aria-label={`搜尋${GENDER_LABEL[gender]}商品`}
            className="w-56 lg:w-72 border border-rule bg-paper/80 px-3 py-1.5 text-sm focus:outline-none focus:border-ink"
          />
        </form>
        <nav className="ml-auto sm:ml-0 flex items-center gap-5 text-sm">
          <Link href={genderPath(gender, "/search")} className="sm:hidden text-ink-soft hover:text-ink">搜尋</Link>
          <div className="flex items-center gap-3" aria-label="女裝或男裝">
            {GENDERS.map((g) => (
              <Link
                key={g}
                href={genderPath(g, "/")}
                aria-current={g === gender ? "page" : undefined}
                className={g === gender ? "text-ink font-medium underline underline-offset-[6px] decoration-2" : "text-ink-soft hover:text-ink"}
              >
                {GENDER_LABEL[g]}
              </Link>
            ))}
          </div>
          <Link href={genderPath(gender, "/deals")} className="text-madder hover:underline underline-offset-4 decoration-1">本週降價</Link>
          <FavoritesLink />
        </nav>
      </div>
    </header>
  );
}
