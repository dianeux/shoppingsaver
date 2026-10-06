import type { Metadata } from "next";
import { FavoritesView } from "@/components/FavoritesView";
import { getLang } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getLang();
  return { title: t.favorites.title };
}

/** The list itself lives in this browser (localStorage); the page fetches current prices for it. */
export default async function FavoritesPage() {
  const { t } = await getLang();
  return (
    <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6 py-8">
      <h1 className="font-display text-5xl sm:text-6xl leading-none mb-3">
        {t.favorites.heading[0]}<em className="text-madder">{t.favorites.heading[1]}</em>
      </h1>
      <p className="text-sm text-ink-soft mb-8 max-w-2xl">{t.favorites.note}</p>
      <FavoritesView />
    </div>
  );
}
