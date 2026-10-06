import type { Metadata } from "next";
import { BrandView, brandMetadata, brandParams } from "@/views/BrandView";

export const revalidate = 3600;

export function generateStaticParams() {
  return brandParams();
}

export async function generateMetadata({ params }: PageProps<"/[lang]/men/brand/[brand]">): Promise<Metadata> {
  return brandMetadata("men", (await params).brand);
}

export default async function Page({ params }: PageProps<"/[lang]/men/brand/[brand]">) {
  return <BrandView gender="men" brand={(await params).brand} />;
}
