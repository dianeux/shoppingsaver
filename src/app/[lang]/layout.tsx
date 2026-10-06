import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { LangProvider } from "@/i18n/client";
import { HTML_LANG, localePath, LOCALES } from "@/i18n/locales";
import { getLang } from "@/i18n/server";
import "../globals.css";

const notoSans = Noto_Sans_TC({ variable: "--font-noto-sans", weight: ["400", "500", "700"], preload: false });

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const { lang, t } = await getLang();
  return {
    title: { default: t.meta.title, template: "%s · ShoppingSaver" },
    description: t.meta.description,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [HTML_LANG[l], localePath(l, "/")])) },
    other: { "content-language": HTML_LANG[lang] },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const { lang, t } = await getLang();
  return (
    <html lang={HTML_LANG[lang]} className={`${notoSans.variable} antialiased`}>
      <body className="min-h-screen flex flex-col">
        <LangProvider lang={lang}>
          <SiteHeader />
          <main className="flex-1">{children}</main>
        </LangProvider>
        <footer className="border-t border-rule/80 mt-16">
          <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6 py-8 text-xs text-ink-faint leading-relaxed flex flex-col sm:flex-row gap-2 sm:justify-between">
            <p>
              {t.footer.indexed}
              <Link href={localePath(lang, "/add")} className="underline underline-offset-2 hover:text-ink">{t.footer.bookmarklet}</Link>
              {t.footer.disclaimer}
            </p>
            <p className="font-mono">material × w + price × (1 − w)</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
