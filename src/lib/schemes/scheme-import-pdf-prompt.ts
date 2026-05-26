import "server-only";

/** Maximum chars sent to the AI in a single call. gpt-4o supports 128 k context. */
export const SCHEME_PDF_MAX_INPUT_CHARS = 40_000;

/** Chunk size for very large PDFs: split into overlapping chunks of this size. */
export const SCHEME_PDF_CHUNK_SIZE = 36_000;

/** Overlap between consecutive chunks (preserves context at chunk boundaries). */
export const SCHEME_PDF_CHUNK_OVERLAP = 2_000;

export const SCHEME_PDF_EXTRACTION_SYSTEM_PROMPT = `You extract Scheme of Learning / scheme-of-work ROWS from messy school PDF text (Ghana NaCCA/GES-style tables).

Return ONLY valid JSON with the shape:
{ "rows": [ {
  "weekNumber": number|null,
  "weekEnding": string|null,
  "title": string,
  "strand": string|null,
  "subStrand": string|null,
  "contentStandard": string|null,
  "indicators": string[],
  "learningOutcomes": string[],
  "teachingLearningActivities": string|null,
  "resources": string[],
  "assessment": string[],
  "learningObjective": string|null,
  "notes": string|null,
  "rowType": "teaching"|"revision"|"examination"|"holiday"|"other",
  "confidence": number,
  "rawText": string|null
} ] }

COLUMN MAPPING — extract ALL that appear in the document; never merge distinct columns into "notes":

1. weekEnding — the date or week-end label (column often labelled "Week Ending", "Date", "Wk End")
2. strand — the strand heading for this row (column labelled "Strand", "Theme")
3. subStrand — sub-strand / sub-topic (column labelled "Sub-strand", "Sub-topic", "Sub Strand")
4. contentStandard — content standard code and/or text, e.g. "B8.1.2.1 …" (column labelled "Content Standard", "Standard", "Curriculum Code")
5. indicators — list of performance indicator codes + short indicator lines; split multi-item cells into separate array strings
   (column labelled "Indicators", "Performance Indicators", "Learning Indicators")
6. learningOutcomes — narrative learning outcomes when they appear in a separate column OR in a combined "Indicators / Learning outcomes" column; split into separate strings
   (column labelled "Learning Outcomes", "Specific Objectives", "Outcomes")
7. teachingLearningActivities — FULL text from the teaching activities column; preserve line breaks with \\n; DO NOT truncate
   (column may be labelled "Teaching & Learning Activities", "T & L Activities", "Learners' Activities", "Core Activities", "Teacher/Learner Activities", "Guided Activities", "Main Activity")
8. resources — list of teaching resources / materials
   (column may be labelled "Resources", "TLMs", "Teaching Aids", "Materials", "References")
9. assessment — assessment tasks / evaluation items
   (column may be labelled "Assessment", "Evaluation", "Core Tasks", "Classwork", "Homework", "Classwork/Homework", "Exercises", "Written Exercise")

STRICT RULES:
- Every row in the output represents ONE teaching week/block.
- weekNumber: integer 1–53 only when clearly stated; otherwise null.
- title: concise topic label (≤ 120 chars), typically from the subStrand or main topic cell.
- teachingLearningActivities: copy the FULL cell content for that column — do NOT abbreviate, summarise, or leave null just because the column has a non-standard heading.
- assessment: copy the FULL cell content — do NOT leave null or put into notes when an assessment/classwork/homework column exists.
- notes: ONLY extra remarks, duration warnings, or overflow that genuinely does not belong to any of the 9 columns above.
- If the document has NO explicit "Teaching & Learning Activities" column but describes activities inline, place them in teachingLearningActivities (not notes).
- rowType: "revision", "examination", or "holiday" when clearly indicated; otherwise "teaching".
- confidence: 0–1.
- rawText: verbatim source text for that row (truncate at 500 chars if needed).
- Skip cover pages, table-of-contents pages, and boilerplate headers.
- Return at most 80 rows per call.`;

export function clipPdfTextForExtraction(rawText: string): string {
  if (rawText.length <= SCHEME_PDF_MAX_INPUT_CHARS) return rawText;
  return `${rawText.slice(0, SCHEME_PDF_MAX_INPUT_CHARS)}\n\n[…text truncated for AI — document is large…]`;
}

/**
 * Splits very large PDF texts into overlapping chunks so each fits within
 * SCHEME_PDF_MAX_INPUT_CHARS while preserving week-block context.
 */
export function chunkPdfText(rawText: string): string[] {
  if (rawText.length <= SCHEME_PDF_MAX_INPUT_CHARS) return [rawText];
  const chunks: string[] = [];
  let start = 0;
  while (start < rawText.length) {
    const end = Math.min(start + SCHEME_PDF_CHUNK_SIZE, rawText.length);
    chunks.push(rawText.slice(start, end));
    if (end >= rawText.length) break;
    start = end - SCHEME_PDF_CHUNK_OVERLAP;
  }
  return chunks;
}

export function buildSchemePdfUserPrompt(clippedText: string, chunkIndex?: number, totalChunks?: number): string {
  const chunkNote =
    chunkIndex != null && totalChunks != null && totalChunks > 1
      ? ` (chunk ${chunkIndex + 1} of ${totalChunks})`
      : "";
  return `Extract every scheme row with ALL nine columns (week ending, strand, sub-strand, content standard, indicators, learning outcomes, teaching & learning activities, resources, assessment). Do not leave teachingLearningActivities or assessment null when the content exists in the text${chunkNote}.\n\nPDF extracted text:\n\n${clippedText}`;
}
