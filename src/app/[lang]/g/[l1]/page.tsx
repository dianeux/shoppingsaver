import type { Metadata } from "next";
import { GroupView, groupMetadata, groupParams } from "@/views/GroupView";

export const revalidate = 3600;

export function generateStaticParams() {
  return groupParams("women");
}

export async function generateMetadata({ params }: PageProps<"/[lang]/g/[l1]">): Promise<Metadata> {
  return groupMetadata("women", (await params).l1);
}

export default async function Page({ params }: PageProps<"/[lang]/g/[l1]">) {
  return <GroupView gender="women" l1={(await params).l1} />;
}
