import type { Metadata } from "next";
import { AddProduct } from "@/components/AddProduct";

export const metadata: Metadata = { title: "加入商品" };

export default function Page() {
  return (
    <div className="mx-auto lg:max-w-[90vw] px-4 sm:px-6 py-8">
      <h1 className="font-display text-5xl sm:text-6xl leading-none mb-6">加入商品</h1>
      <AddProduct />
    </div>
  );
}
