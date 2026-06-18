import { flashcardsAreDuplicates, type FlashcardPair } from "@/lib/lessons/flashcard-generation";

export type FactCardDraft = {
  fact: string;
  detail: string;
  tags: string[];
  illustrationSuggested?: boolean;
  illustrationPrompt?: string | null;
  illustrationUrl?: string | null;
  illustrationUploadThingKey?: string | null;
};

export const FACT_HOOK_MAX = 500;
export const FACT_DETAIL_MAX = 2000;
export const FACT_ILLUSTRATION_PROMPT_MAX = 220;

function asFactPair(card: Pick<FactCardDraft, "fact" | "detail">): FlashcardPair {
  return { front: card.fact, back: card.detail };
}

export function factCardsAreDuplicates(a: Pick<FactCardDraft, "fact" | "detail">, b: Pick<FactCardDraft, "fact" | "detail">): boolean {
  return flashcardsAreDuplicates(asFactPair(a), asFactPair(b));
}

export function sanitizeFactCardDraft(raw: Record<string, unknown>, index: number): FactCardDraft | null {
  const fact = String(raw.fact || `Fact ${index + 1}`).trim().slice(0, FACT_HOOK_MAX);
  const detail = String(raw.detail || "").trim().slice(0, FACT_DETAIL_MAX);
  if (!fact || fact.length < 12 || !detail || detail.length < 24) return null;

  const tags = Array.isArray(raw.tags)
    ? (raw.tags as unknown[])
        .map((tag) => String(tag).trim().slice(0, 60))
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const illustrationSuggested = raw.illustrationSuggested === true;
  let illustrationPrompt: string | null = null;
  if (illustrationSuggested && typeof raw.illustrationPrompt === "string") {
    illustrationPrompt = raw.illustrationPrompt.trim().slice(0, FACT_ILLUSTRATION_PROMPT_MAX) || null;
  }

  return {
    fact,
    detail,
    tags,
    illustrationSuggested: illustrationSuggested && Boolean(illustrationPrompt),
    illustrationPrompt,
  };
}

export function parseLeoFactCardResponse(data: unknown): FactCardDraft[] {
  const rawCards = (data as { factCards?: unknown })?.factCards;
  if (!Array.isArray(rawCards)) return [];

  const out: FactCardDraft[] = [];
  for (let i = 0; i < rawCards.length; i++) {
    const item = rawCards[i];
    if (!item || typeof item !== "object") continue;
    const sanitized = sanitizeFactCardDraft(item as Record<string, unknown>, i);
    if (sanitized) out.push(sanitized);
  }
  return out;
}

export function dedupeFactCardCandidates(
  candidates: FactCardDraft[],
  existing: Array<Pick<FactCardDraft, "fact" | "detail">>,
): { unique: FactCardDraft[]; skipped: number } {
  const pool: Array<Pick<FactCardDraft, "fact" | "detail">> = [...existing];
  const unique: FactCardDraft[] = [];
  let skipped = 0;

  for (const candidate of candidates) {
    const sanitized = sanitizeFactCardDraft(
      {
        fact: candidate.fact,
        detail: candidate.detail,
        tags: candidate.tags,
        illustrationSuggested: candidate.illustrationSuggested,
        illustrationPrompt: candidate.illustrationPrompt,
      },
      unique.length,
    );
    if (!sanitized) {
      skipped += 1;
      continue;
    }
    if (pool.some((row) => factCardsAreDuplicates(sanitized, row))) {
      skipped += 1;
      continue;
    }
    unique.push({
      ...sanitized,
      illustrationUrl: candidate.illustrationUrl ?? null,
      illustrationUploadThingKey: candidate.illustrationUploadThingKey ?? null,
    });
    pool.push(sanitized);
  }

  return { unique, skipped };
}

export function buildFactCardSystemInstruction(count: number): string {
  return `Return JSON only:
{
  "factCards": [
    {
      "fact": string,
      "detail": string,
      "tags": string[],
      "illustrationSuggested": boolean,
      "illustrationPrompt": string | null
    }
  ]
}

Rules:
- Exactly ${count} items in "factCards".
- Each card must cover a DIFFERENT idea from the lesson — no paraphrased repeats.
- "fact": one short curiosity hook (max 220 chars). No filler like "did you know we learned today".
- "detail": 2-3 short sentences (max 480 chars) explaining the hook.
- Ground every card in the session content; do not invent unrelated trivia.
- Age-appropriate, encouraging language for Ghanaian schools.
- illustrationSuggested: true only when a simple, safe diagram or scene would clearly help (maps, cycles, anatomy, weather instruments). Otherwise false.
- illustrationPrompt: required when illustrationSuggested is true — max ${FACT_ILLUSTRATION_PROMPT_MAX} chars, classroom-safe, no text in image, no faces of real people.`;
}

export function formatExistingFactCardsForPrompt(
  cards: Array<Pick<FactCardDraft, "fact" | "detail">>,
): string {
  if (cards.length === 0) return "(none yet)";
  return cards
    .slice(-15)
    .map((card, index) => `${index + 1}. ${card.fact}\n   ${card.detail}`)
    .join("\n");
}

export function buildFactCardUserPrompt(input: {
  title: string;
  subjectName: string;
  contentSummary: string;
  count: number;
  existingCards: Array<Pick<FactCardDraft, "fact" | "detail">>;
  retryAttempt?: number;
}): string {
  const retryLine =
    input.retryAttempt && input.retryAttempt > 0
      ? `\nRETRY ${input.retryAttempt}: Prior drafts repeated existing facts. Use completely different lesson angles.`
      : "";

  return `Generate ${input.count} "Did You Know" curiosity fact cards for EduSentrix Learn.${retryLine}

Session title: ${input.title}
Subject: ${input.subjectName}

Session content summary:
${input.contentSummary || "(no content blocks yet — use the session title and subject as context)"}

Already published or drafted for this session (do NOT repeat or lightly rephrase):
${formatExistingFactCardsForPrompt(input.existingCards)}`;
}
