import { validateSubmission } from "@/domain/clip";
import { saveSubmission, visitorHash } from "@/lib/submissions";

/** POST a bookmarklet draft (SubmissionInput). Validated again here; the client's checks are only for the form. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const v = validateSubmission(body);
  // Error codes only; the page shows them in the visitor's language.
  if (!v.ok) return Response.json({ errors: v.errors }, { status: 422 });
  const r = await saveSubmission(v.value, visitorHash(request));
  if (!r.ok) {
    return Response.json({ error: r.reason }, { status: r.reason === "rate_limited" ? 429 : 409 });
  }
  return Response.json(r, { status: r.created ? 201 : 200 });
}
