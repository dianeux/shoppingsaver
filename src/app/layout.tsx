import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Noto_Sans_TC, Noto_Serif_TC } from "next/font/google";
import Link from "next/link";
import { FavoritesLink } from "@/components/FavoritesLink";
import "./globals.css";

const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const notoSerif = Noto_Serif_TC({ variable: "--font-noto-serif", weight: ["500", "700"], preload: false });
const notoSans = Noto_Sans_TC({ variable: "--font-noto-sans", weight: ["400", "500", "700"], preload: false });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "ShoppingSaver — 看清楚每個價格帶買到什麼", template: "%s · ShoppingSaver" },
  description: "跨品牌基本款女裝目錄，屬性統一、依材質與價格的性價比排序。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className={`${instrument.variable} ${notoSerif.variable} ${notoSans.variable} ${plexMono.variable} antialiased`}>
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-rule/80 bg-cloth/85 backdrop-blur-sm sticky top-0 z-30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center gap-6">
            <Link href="/" className="flex items-baseline gap-2 shrink-0">
              <span className="font-display text-2xl leading-none tracking-tight">ShoppingSaver</span>
              <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">women · us</span>
            </Link>
            <form action="/search" role="search" className="ml-auto hidden sm:block">
              <input
                name="q"
                placeholder="搜尋：低胸 T恤、寬褲 亞麻…"
                aria-label="搜尋商品"
                className="w-56 lg:w-72 border border-rule bg-paper/80 px-3 py-1.5 text-sm focus:outline-none focus:border-ink"
              />
            </form>
            <nav className="ml-auto sm:ml-0 flex items-center gap-5 text-sm">
              <Link href="/search" className="sm:hidden text-ink-soft hover:text-ink">搜尋</Link>
              <Link href="/" className="text-ink-soft hover:text-ink">品類</Link>
              <Link href="/deals" className="text-madder hover:underline underline-offset-4 decoration-1">本週降價</Link>
              <FavoritesLink />
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-rule/80 mt-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 text-xs text-ink-faint leading-relaxed flex flex-col sm:flex-row gap-2 sm:justify-between">
            <p>價格與成分每晚從各品牌美國官網索引。實際價格以原站為準；本站不販售商品。</p>
            <p className="font-mono">material × w + price × (1 − w)</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
