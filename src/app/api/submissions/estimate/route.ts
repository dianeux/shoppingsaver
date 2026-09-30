import { materialScore, parseComposition } from "@/domain/composition";
import { isGender } from "@/domain/gender";
import { isL2 } from "@/domain/taxonomy";
import { estimate } from "@/lib/submissions";

/** GET ?g=women&l2=tshirts&price=19.9&comp=100% cotton → where the product would rank (preview only, nothing saved). */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const g = q.get("g") ?? "";
  const l2 = q.get("l2") ?? "";
  const price = Number(q.get("price"));
  if (!isGender(g) || !isL2(l2) || !(price > 0)) return Response.json({ error: "g, l2 and price are required" }, { status: 400 });
  const parsed = parseComposition((q.get("comp") ?? "").slice(0, 1000));
  return Response.json(await estimate(g, l2, price, parsed.ok ? materialScore(parsed.composition.main) : null));
}
