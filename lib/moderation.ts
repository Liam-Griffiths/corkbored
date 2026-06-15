import Anthropic from "@anthropic-ai/sdk";
import { prefilter } from "./prefilter";

export type TriageVerdict = "clean" | "borderline" | "spam";

export type TriageResult = {
  verdict: TriageVerdict;
  confidence: number;
  reasons: string;
};

const SYSTEM_PROMPT = `You are a content triage classifier for Corkbored, a platform where software
developers post side projects and apply to collaborate. Classify the content
as exactly one of: clean, borderline, spam.

spam = promotional scams, payment/crypto solicitation, phishing links, repo
spam (forks with no original work posted as projects), mass-posted duplicate
text, or abusive/harassing content.
borderline = low-effort but plausibly sincere (e.g., a one-line application
from a new developer), off-topic but harmless, or anything you are unsure of.
clean = ordinary good-faith content.

Never classify content as spam merely because the author seems inexperienced.
Respond with ONLY a JSON object: {"verdict": "...", "confidence": 0.0-1.0,
"reasons": "<one or two short sentences>"}`;

const FALLBACK: TriageResult = {
  verdict: "borderline",
  confidence: 0,
  reasons: "triage failed — needs human review",
};

export function parseResult(raw: string): TriageResult {
  // Strip code fences if present
  const cleaned = raw.replace(/```(?:json)?\n?/g, "").trim();
  const parsed = JSON.parse(cleaned) as {
    verdict: unknown;
    confidence: unknown;
    reasons: unknown;
  };

  const VERDICTS: TriageVerdict[] = ["clean", "borderline", "spam"];
  const verdict = VERDICTS.includes(parsed.verdict as TriageVerdict)
    ? (parsed.verdict as TriageVerdict)
    : "borderline";

  const confidence =
    typeof parsed.confidence === "number"
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0;

  const reasons =
    typeof parsed.reasons === "string" ? parsed.reasons.slice(0, 500) : FALLBACK.reasons;

  return { verdict, confidence, reasons };
}

export async function triage(
  subjectType: string,
  text: string,
  context?: string,
): Promise<TriageResult> {
  // Stage 1: synchronous rule-based prefilter (no API call, always runs)
  const pre = prefilter(text);
  if (pre.verdict === "spam") {
    return { verdict: "spam", confidence: 1, reasons: pre.reason };
  }

  // Stage 2: AI triage — skip if no API key configured
  if (!process.env.ANTHROPIC_API_KEY) {
    // Prefilter passed, but AI is off — queue for human review rather than auto-publish
    return { verdict: "borderline", confidence: 0, reasons: "AI triage disabled — queued for human review" };
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const userMessage = [
      `Subject type: ${subjectType}`,
      context ? `Context: ${context}` : null,
      `Content:\n${text.slice(0, 3000)}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const raw =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    return parseResult(raw);
  } catch {
    return FALLBACK;
  }
}
