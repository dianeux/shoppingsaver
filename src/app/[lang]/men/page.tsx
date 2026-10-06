import type { Metadata } from "next";
import { getLang } from "@/i18n/server";
import { HomeView } from "@/views/HomeView";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getLang();
  return { title: t.gender.men };
}

export default function Page() {
  return <HomeView gender="men" />;
}
