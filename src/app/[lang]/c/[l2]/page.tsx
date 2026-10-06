import type { Metadata } from "next";
import { CategoryView, categoryMetadata, categoryParams } from "@/views/CategoryView";

export const revalidate = 3600;

export function generateStaticParams() {
  return categoryParams();
}

export async function generateMetadata({ params }: PageProps<"/[lang]/c/[l2]">): Promise<Metadata> {
  return categoryMetadata("women", (await params).l2);
}

export default async function Page({ params }: PageProps<"/[lang]/c/[l2]">) {
  return <CategoryView gender="women" l2={(await params).l2} />;
}
