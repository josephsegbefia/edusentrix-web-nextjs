export type FlashcardPair = {
  front: string;
  back: string;
};

export const FLASHCARD_FRONT_MAX = 140;
export const FLASHCARD_BACK_MAX = 200;

/** Grammar/filler only — keep subject terms like "elements", "climate", "humidity". */
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "what",
  "which",
  "who",
  "how",
  "why",
  "when",
  "where",
  "we",
  "you",
  "they",
  "our",
  "your",
  "in",
  "on",
  "at",
  "to",
  "of",
  "for",
  "and",
  "or",
  "about",
  "from",
  "today",
  "this",
  "that",
  "did",
  "does",
  "do",
]);

/** Card-by-card slots steer Leo toward different concepts instead of repeating the headline fact. */
export const FLASHCARD_SLOT_FOCUS: Array<{ label: string; instruction: string }> = [
  {
    label: "Core term",
    instruction: "Ask for the definition of ONE important term from the lesson (not a recap of the whole lesson).",
  },
  {
    label: "Second concept",
    instruction: "Cover a DIFFERENT concept, process, or idea from the lesson — not the same topic as other cards.",
  },
  {
    label: "Compare",
    instruction: "Use a compare/contrast or 'difference between' question (e.g. weather vs climate).",
  },
  {
    label: "Example",
    instruction: "Ask for a concrete Ghanaian classroom example or real-world application from the lesson.",
  },
  {
    label: "How it works",
    instruction: "Ask HOW or WHY something happens according to the lesson (cause, steps, or mechanism).",
  },
  {
    label: "Measurement",
    instruction: "Ask about how something is measured, observed, or described using lesson vocabulary.",
  },
  {
    label: "Vocabulary",
    instruction: "Test one subject-specific word or phrase and its meaning in one short answer.",
  },
  {
    label: "Check understanding",
    instruction: "Pose a short scenario or 'what would happen if' question grounded in the lesson.",
  },
];

export function normalizeFlashcardText(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulWords(text: string): string[] {
  return normalizeFlashcardText(text)
    .split(" ")
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function wordJaccard(a: string, b: string): number {
  const setA = new Set(meaningfulWords(a));
  const setB = new Set(meaningfulWords(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Share of the smaller word set covered by the other side — catches paraphrased prompts. */
function coreOverlapRatio(a: string, b: string): number {
  const setA = new Set(meaningfulWords(a));
  const setB = new Set(meaningfulWords(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection += 1;
  }
  return intersection / Math.min(setA.size, setB.size);
}

/** True when two cards would feel like the same revision prompt to a student. */
export function flashcardsAreDuplicates(a: FlashcardPair, b: FlashcardPair): boolean {
  const frontWordsA = meaningfulWords(a.front);
  const frontWordsB = meaningfulWords(b.front);
  const frontJaccard = wordJaccard(a.front, b.front);
  const backJaccard = wordJaccard(a.back, b.back);
  const frontCore = coreOverlapRatio(a.front, b.front);
  const backCore = coreOverlapRatio(a.back, b.back);
  const richFrontComparison =
    frontWordsA.length >= 2 &&
    frontWordsB.length >= 2 &&
    new Set([...frontWordsA, ...frontWordsB]).size >= 3;

  if (richFrontComparison && frontJaccard >= 0.5) return true;
  if (richFrontComparison && frontCore >= 0.62) return true;
  if (richFrontComparison && frontCore >= 0.45 && backCore >= 0.55) return true;
  if (richFrontComparison && frontCore >= 0.38 && backJaccard >= 0.45) return true;

  // Same answer, paraphrased question.
  if (backCore >= 0.72 && frontCore >= 0.34) return true;
  if (backJaccard >= 0.62 && frontCore >= 0.4) return true;

  const normFrontA = normalizeFlashcardText(a.front);
  const normFrontB = normalizeFlashcardText(b.front);
  if (normFrontA === normFrontB) return true;

  const shorter = normFrontA.length <= normFrontB.length ? normFrontA : normFrontB;
  const longer = normFrontA.length > normFrontB.length ? normFrontA : normFrontB;
  if (shorter.length >= 28 && longer.includes(shorter)) return true;

  return false;
}

function isDuplicateAgainstPool(card: FlashcardPair, pool: FlashcardPair[]): boolean {
  return pool.some((existing) => flashcardsAreDuplicates(card, existing));
}

export function sanitizeFlashcardPair(card: FlashcardPair): FlashcardPair | null {
  const front = card.front.trim().slice(0, FLASHCARD_FRONT_MAX);
  let back = card.back.trim().replace(/\s+/g, " ");

  // Drop backs that mostly repeat the front question.
  const frontNorm = normalizeFlashcardText(front);
  const backNorm = normalizeFlashcardText(back);
  if (backNorm.startsWith(frontNorm.slice(0, Math.min(frontNorm.length, 40)))) {
    const sentences = back.split(/(?<=[.!?])\s+/);
    back = sentences.length > 1 ? sentences.slice(1).join(" ").trim() : back;
  }

  back = back.slice(0, FLASHCARD_BACK_MAX);

  if (!front || !back) return null;
  if (front.length < 8 || back.length < 4) return null;
  return { front, back };
}

export function parseLeoFlashcardResponse(data: unknown): FlashcardPair[] {
  const raw = (data as { cards?: unknown })?.cards;
  if (!Array.isArray(raw)) return [];

  const out: FlashcardPair[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as { front?: unknown; back?: unknown };
    const sanitized = sanitizeFlashcardPair({
      front: String(row.front ?? ""),
      back: String(row.back ?? ""),
    });
    if (sanitized) out.push(sanitized);
  }
  return out;
}

/** IDs of cards that repeat an earlier card in deck order (first occurrence kept). */
export function findDuplicateFlashcardIds(
  cards: Array<{ id: string; front: string; back: string }>,
): string[] {
  const kept: FlashcardPair[] = [];
  const duplicateIds: string[] = [];

  for (const card of cards) {
    const pair = { front: card.front, back: card.back };
    if (kept.some((existing) => flashcardsAreDuplicates(existing, pair))) {
      duplicateIds.push(card.id);
    } else {
      kept.push(pair);
    }
  }

  return duplicateIds;
}

export function dedupeFlashcardCandidates(
  candidates: FlashcardPair[],
  existing: FlashcardPair[],
): { unique: FlashcardPair[]; skipped: number } {
  const unique: FlashcardPair[] = [];
  const pool = [...existing];
  let skipped = 0;

  for (const candidate of candidates) {
    const sanitized = sanitizeFlashcardPair(candidate);
    if (!sanitized) {
      skipped += 1;
      continue;
    }
    if (isDuplicateAgainstPool(sanitized, pool)) {
      skipped += 1;
      continue;
    }
    unique.push(sanitized);
    pool.push(sanitized);
  }

  return { unique, skipped };
}

export function buildSessionFlashcardSystemInstruction(maxCards: number): string {
  return `Return JSON only:
{
  "cards": [
    { "front": string, "back": string }
  ]
}

Flashcard quality rules (strict):
- Exactly ${maxCards} item(s) in "cards".
- Each card tests ONE atomic fact — never recap the whole lesson on one card.
- Front: a single clear question, max ${FLASHCARD_FRONT_MAX} characters. No filler like "we learned about today".
- Back: a direct, short answer only — max ${FLASHCARD_BACK_MAX} characters. Do NOT restate the question.
- Every card must cover a DIFFERENT concept, term, comparison, example, or process from the lesson.
- Do NOT paraphrase the same question with different wording.
- Prefer: definitions, contrasts, examples, how/why, measurements, and vocabulary — spread across the lesson content.
- Banned: multiple cards listing the same set of items (e.g. repeating "temperature, humidity, wind" across cards).`;
}

export function formatExistingCardsForPrompt(cards: FlashcardPair[]): string {
  if (cards.length === 0) return "(none yet)";
  return cards
    .slice(-20)
    .map((card, index) => `${index + 1}. Q: ${card.front}\n   A: ${card.back}`)
    .join("\n");
}

export function buildSessionFlashcardUserPrompt(input: {
  title: string;
  planNotes: string;
  contentSummary: string;
  maxCards: number;
  existingCards: FlashcardPair[];
  slotIndex?: number;
  totalSlots?: number;
  retryAttempt?: number;
}): string {
  const existingBlock = formatExistingCardsForPrompt(input.existingCards);
  const slot =
    input.slotIndex != null
      ? FLASHCARD_SLOT_FOCUS[input.slotIndex % FLASHCARD_SLOT_FOCUS.length]
      : null;

  const slotLine = slot
    ? `This is card ${input.slotIndex! + 1} of ${input.totalSlots ?? input.maxCards}. Focus type: ${slot.label}. ${slot.instruction}`
    : `Produce ${input.maxCards} mutually distinct cards — each must test different lesson content.`;

  const retryLine =
    input.retryAttempt && input.retryAttempt > 0
      ? `\nRETRY ${input.retryAttempt}: Your last draft duplicated an existing card. Pick a completely different concept from the lesson content below.`
      : "";

  return `Draft ${input.maxCards} revision flashcard(s) for this taught session.
${slotLine}${retryLine}

Session title: ${input.title}
Plan notes: ${input.planNotes || "(none)"}
Lesson content blocks:
${input.contentSummary || "(no blocks yet)"}

Cards already in the deck (do NOT duplicate or lightly rephrase these):
${existingBlock}`;
}
