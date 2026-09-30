import type { Metadata } from "next";
import { CategoryView, categoryMetadata, categoryParams } from "@/views/CategoryView";

export const revalidate = 3600;

export function generateStaticParams() {
  return categoryParams();
}

export async function generateMetadata({ params }: PageProps<"/men/c/[l2]">): Promise<Metadata> {
  return categoryMetadata("men", (await params).l2);
}

export default async function Page({ params }: PageProps<"/men/c/[l2]">) {
  return <CategoryView gender="men" l2={(await params).l2} />;
}
