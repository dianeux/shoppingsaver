import type { Metadata } from "next";
import { SearchView, searchMetadata } from "@/views/SearchView";

export async function generateMetadata({ searchParams }: PageProps<"/[lang]/search">): Promise<Metadata> {
  return searchMetadata("women", (await searchParams).q);
}

export default async function Page({ searchParams }: PageProps<"/[lang]/search">) {
  return <SearchView gender="women" q={(await searchParams).q} />;
}
