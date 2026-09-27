import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Browser } from "@/components/Browser";
import { SiteNotice } from "@/components/SiteNotice";
import { isL2, L2_INDEX, type L2 } from "@/domain/taxonomy";
import { productsForL2, siteStatus } from "@/lib/catalog";

export const revalidate = 3600;

// Pre-render every category; ISR refreshes them hourly after the nightly index.
export function generateStaticParams() {
  return (Object.keys(L2_INDEX) as L2[]).map((l2) => ({ l2 }));
}

export async function generateMetadata({ params }: PageProps<"/c/[l2]">): Promise<Metadata> {
  const { l2 } = await params;
  return { title: isL2(l2) ? L2_INDEX[l2].name : "品類" };
}

export default async function CategoryPage({ params }: PageProps<"/c/[l2]">) {
  const { l2 } = await params;
  if (!isL2(l2)) notFound();
  const [items, status] = await Promise.all([productsForL2(l2), siteStatus()]);
  const info = L2_INDEX[l2];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <nav className="font-mono text-[11px] text-ink-faint mb-2">
        <Link href="/" className="hover:text-ink">品類</Link> /{" "}
        <Link href={`/g/${info.l1}`} className="hover:text-ink">{info.l1Name}</Link>
      </nav>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mb-8">
        <h1 className="font-display text-5xl sm:text-6xl leading-none">{info.name}</h1>
        <div className="pb-1">
          <SiteNotice {...status} />
        </div>
      </div>
      <Browser products={items} />
    </div>
  );
}
