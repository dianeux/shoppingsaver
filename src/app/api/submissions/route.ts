import { SUBMISSION_ERROR_COPY, validateSubmission } from "@/domain/clip";
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
  if (!v.ok) return Response.json({ errors: v.errors, messages: v.errors.map((e) => SUBMISSION_ERROR_COPY[e]) }, { status: 422 });
  const r = await saveSubmission(v.value, visitorHash(request));
  if (!r.ok) {
    return r.reason === "rate_limited"
      ? Response.json({ error: "一小時內提交太多次，請稍後再試。" }, { status: 429 })
      : Response.json({ error: "這件商品已在目錄中。" }, { status: 409 });
  }
  return Response.json(r, { status: r.created ? 201 : 200 });
}
