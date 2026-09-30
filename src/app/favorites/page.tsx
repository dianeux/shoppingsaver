import type { Metadata } from "next";
import { FavoritesView } from "@/components/FavoritesView";

export const metadata: Metadata = { title: "我的最愛" };

/** The list itself lives in this browser (localStorage); the page fetches current prices for it. */
export default function FavoritesPage() {
  return (
    <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6 py-8">
      <h1 className="font-display text-5xl sm:text-6xl leading-none mb-3">
        我的<em className="text-madder">最愛</em>
      </h1>
      <p className="text-sm text-ink-soft mb-8 max-w-2xl">價格、降價與庫存狀態都是最新一次索引的資料。清單只存在這台裝置的瀏覽器，換裝置或清除瀏覽器資料就會消失。</p>
      <FavoritesView />
    </div>
  );
}
