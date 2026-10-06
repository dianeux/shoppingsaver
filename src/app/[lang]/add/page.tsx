import type { Metadata } from "next";
import { AddProduct } from "@/components/AddProduct";
import { getLang } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getLang();
  return { title: t.add.title };
}

export default async function Page() {
  const { t } = await getLang();
  return (
    <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6 py-8">
      <h1 className="font-display text-5xl sm:text-6xl leading-none mb-6">{t.add.title}</h1>
      <AddProduct />
    </div>
  );
}
