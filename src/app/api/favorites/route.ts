import { productsByIds } from "@/lib/catalog";

/** Ids look like "everlane:2437"; anything else is ignored. */
const ID = /^[a-z]+:[\w.-]{1,64}$/;
const MAX_IDS = 500;

/** POST { ids: string[] } → the current data for those favorites (browser-held list, no account). */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const raw = (body as { ids?: unknown })?.ids;
  if (!Array.isArray(raw)) return Response.json({ error: "ids must be an array" }, { status: 400 });
  const ids = [...new Set(raw.filter((x): x is string => typeof x === "string" && ID.test(x)))].slice(0, MAX_IDS);
  return Response.json({ products: await productsByIds(ids) });
}
