import type { Metadata } from "next";
import { DealsView, dealsMetadata } from "@/views/DealsView";

export const revalidate = 3600;

export function generateMetadata(): Promise<Metadata> {
  return dealsMetadata("women");
}

export default function Page() {
  return <DealsView gender="women" />;
}
