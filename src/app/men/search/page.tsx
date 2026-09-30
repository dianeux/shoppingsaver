import type { Metadata } from "next";
import { SearchView, searchMetadata } from "@/views/SearchView";

export async function generateMetadata({ searchParams }: PageProps<"/men/search">): Promise<Metadata> {
  return searchMetadata("men", (await searchParams).q);
}

export default async function Page({ searchParams }: PageProps<"/men/search">) {
  return <SearchView gender="men" q={(await searchParams).q} />;
}
