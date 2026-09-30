import type { Metadata } from "next";
import { BrandView, brandMetadata, brandParams } from "@/views/BrandView";

export const revalidate = 3600;

export function generateStaticParams() {
  return brandParams();
}

export async function generateMetadata({ params }: PageProps<"/brand/[brand]">): Promise<Metadata> {
  return brandMetadata("women", (await params).brand);
}

export default async function Page({ params }: PageProps<"/brand/[brand]">) {
  return <BrandView gender="women" brand={(await params).brand} />;
}
