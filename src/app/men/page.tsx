import type { Metadata } from "next";
import { HomeView } from "@/views/HomeView";

export const revalidate = 3600;
export const metadata: Metadata = { title: "男裝" };

export default function Page() {
  return <HomeView gender="men" />;
}
