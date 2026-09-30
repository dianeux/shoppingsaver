import { reportGone, visitorHash } from "@/lib/submissions";

const ID = /^(hm|zara|uniqlo|gu):(men:)?[\w.-]{1,64}$/;

/** POST { id } — a visitor says this user-submitted product is no longer sold. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const id = (body as { id?: unknown })?.id;
  if (typeof id !== "string" || !ID.test(id)) return Response.json({ error: "invalid id" }, { status: 400 });
  const result = await reportGone(id, visitorHash(request));
  const status = { counted: 200, already_reported: 200, rate_limited: 429, not_found: 404 }[result];
  return Response.json({ result }, { status });
}
