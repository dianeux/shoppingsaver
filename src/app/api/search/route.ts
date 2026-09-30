import { isGender } from "@/domain/gender";
import { isEmptyQuery, parseQuery } from "@/domain/search";
import { isL2 } from "@/domain/taxonomy";
import { searchWithin } from "@/lib/catalog";

/**
 * GET ?q=長袖&l2=dresses,jumpsuits&g=women → { matches: { [id]: relevance } }
 * Powers the search box on browse pages: the page already holds the products,
 * so only ids and scores come back.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = parseQuery((params.get("q") ?? "").slice(0, 120));
  const l2s = (params.get("l2") ?? "").split(",").filter(isL2);
  const g = params.get("g") ?? "women";
  const gender = isGender(g) ? g : "women";
  if (isEmptyQuery(q) || l2s.length === 0) return Response.json({ matches: {} });
  return Response.json(
    { matches: await searchWithin(q, l2s, gender) },
    // The catalog changes at most hourly.
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3000" } },
  );
}
