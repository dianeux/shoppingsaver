import type { Metadata } from "next";
import { GroupView, groupMetadata, groupParams } from "@/views/GroupView";

export const revalidate = 3600;

export function generateStaticParams() {
  return groupParams("men");
}

export async function generateMetadata({ params }: PageProps<"/[lang]/men/g/[l1]">): Promise<Metadata> {
  return groupMetadata("men", (await params).l1);
}

export default async function Page({ params }: PageProps<"/[lang]/men/g/[l1]">) {
  return <GroupView gender="men" l1={(await params).l1} />;
}
