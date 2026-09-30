import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const notoSans = Noto_Sans_TC({ variable: "--font-noto-sans", weight: ["400", "500", "700"], preload: false });

export const metadata: Metadata = {
  title: { default: "ShoppingSaver — 找出 CP 值最高的衣服", template: "%s · ShoppingSaver" },
  description: "跨品牌基本款女裝目錄，屬性統一、依材質與價格的性價比排序。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className={`${notoSans.variable} antialiased`}>
      <body className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-rule/80 mt-16">
          <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6 py-8 text-xs text-ink-faint leading-relaxed flex flex-col sm:flex-row gap-2 sm:justify-between">
            <p>價格與成分每晚從各品牌美國官網索引。實際價格以原站為準；本站不販售商品。</p>
            <p className="font-mono">material × w + price × (1 − w)</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
