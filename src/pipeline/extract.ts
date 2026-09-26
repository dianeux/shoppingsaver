import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { parseComposition, type Composition, type CompositionStatus } from "@/domain/composition";

/**
 * Composition extraction (PRD F18). Two stages:
 *  1. deterministic parser on the fiber-label text — free, handles the common shapes
 *  2. Claude Haiku 4.5 reshapes messy text into {name, percentage} pairs; the result is
 *     re-serialized and pushed back through the same parser, so fiber classes,
 *     coefficients and the 100% check are always ours, never the model's.
 */
const MODEL = "claude-haiku-4-5";
const PRICE_PER_MTOK = { input: 1.0, output: 5.0 };

const LlmComposition = z.object({
  disclosed: z.boolean().describe("false if the text contains no fiber percentages at all"),
  parts: z.array(
    z.object({
      label: z.string().nullable().describe('Garment part as written, e.g. "Body", "Shell", "Lining"; null if unlabeled'),
      fibers: z.array(z.object({ name: z.string().describe("Fiber name in English as written, e.g. Organic Cotton"), percentage: z.number() })),
    }),
  ),
});

const SYSTEM = `You convert garment fiber-content labels into structured data.
Copy fiber names and percentages exactly as stated; translate non-English fiber names to English.
Do not infer fibers that are not stated. Do not normalize or merge fibers.
If the text has no fiber percentages, return disclosed=false and an empty parts list.`;

export interface ExtractionOutcome {
  status: CompositionStatus;
  composition: Composition | null;
  source: "parser" | "llm" | null;
  reason?: string;
}

export class LlmBudget {
  inputTokens = 0;
  outputTokens = 0;
  constructor(private readonly maxUsd: number) {}
  get spentUsd() {
    return (this.inputTokens * PRICE_PER_MTOK.input + this.outputTokens * PRICE_PER_MTOK.output) / 1e6;
  }
  get exhausted() {
    return this.spentUsd >= this.maxUsd;
  }
}

let client: Anthropic | null | undefined;
function getClient(): Anthropic | null {
  if (client === undefined) client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  return client;
}

async function llmExtract(text: string, budget: LlmBudget): Promise<z.infer<typeof LlmComposition> | null> {
  const c = getClient();
  if (!c || budget.exhausted) return null;
  try {
    const res = await c.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: `<label>\n${text.slice(0, 3000)}\n</label>` }],
      output_config: { format: zodOutputFormat(LlmComposition) },
    });
    budget.inputTokens += res.usage.input_tokens;
    budget.outputTokens += res.usage.output_tokens;
    return res.parsed_output ?? null;
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError || (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500)) {
      console.warn(`[extract] transient LLM error, leaving as extraction_failed: ${err.message}`);
      return null;
    }
    throw err;
  }
}

function serialize(parts: z.infer<typeof LlmComposition>["parts"]): string {
  return parts
    .map((p) => `${p.label ? `${p.label}: ` : ""}${p.fibers.map((f) => `${f.percentage}% ${f.name}`).join(", ")}`)
    .join(". ");
}

/**
 * @param labelText text of the fiber-content block, or null when the page has none.
 *   US law requires disclosure, so null means "brand didn't publish it on the page" —
 *   reported as not_disclosed, which is a fact, not a bug.
 */
export async function extractComposition(labelText: string | null, budget: LlmBudget | null): Promise<ExtractionOutcome> {
  if (!labelText || !labelText.trim()) return { status: "not_disclosed", composition: null, source: null };

  const parsed = parseComposition(labelText);
  if (parsed.ok) return { status: "extracted", composition: parsed.composition, source: "parser" };

  // budget === null: parser-only retry of a previously failed, unchanged product.
  const llm = budget ? await llmExtract(labelText, budget) : null;
  if (!llm) return { status: "extraction_failed", composition: null, source: null, reason: `parser:${parsed.reason}` };
  if (!llm.disclosed || llm.parts.length === 0) {
    return { status: "extraction_failed", composition: null, source: "llm", reason: "llm_found_none_in_label" };
  }
  const reparsed = parseComposition(serialize(llm.parts));
  if (!reparsed.ok) {
    return {
      status: "extraction_failed",
      composition: null,
      source: "llm",
      reason: `llm_validation:${reparsed.reason}${reparsed.unknownFibers ? `:${reparsed.unknownFibers.join("|")}` : ""}`,
    };
  }
  return { status: "extracted", composition: reparsed.composition, source: "llm" };
}
