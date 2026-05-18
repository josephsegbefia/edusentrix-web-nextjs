import "server-only";

export const SCHEME_PDF_MAX_INPUT_CHARS = 18_000;

export const SCHEME_PDF_EXTRACTION_SYSTEM_PROMPT = `You extract Scheme of Learning / scheme-of-work ROWS from messy school PDF text.
Return JSON only with shape:
{ "rows": [ {
  "weekNumber": number|null,
  "weekEnding": string|null,
  "title": string,
  "strand": string|null,
  "subStrand": string|null,
  "contentStandard": string|null,
  "indicators": string[],
  "resources": string[],
  "learningObjective": string|null,
  "notes": string|null,
  "rowType": "teaching"|"revision"|"examination"|"holiday"|"other",
  "confidence": number,
  "rawText": string|null
} ] }
Rules:
- Each row is one teaching block/week/topic line from the document.
- weekNumber: infer week number (1–53) only when clearly indicated; otherwise null.
- weekEnding: preserve the date/text from a "week ending" column if present.
- title: short topic/unit title (max ~120 chars). Prefer subStrand; otherwise strand/contentStandard/indicator. Use REVISION or EXAMINATION for those rows.
- strand/subStrand/contentStandard/indicators/resources: preserve these columns when present.
- indicators: split multiple indicator codes into separate strings.
- resources: split comma/newline separated resources into separate strings.
- learningObjective: objectives/outcomes if present, else null.
- notes: assessment hints, duration, extra remarks, or anything important that does not fit the other fields.
- rowType: teaching for normal rows, revision for revision rows, examination for exam rows, holiday for holidays.
- confidence: your certainty this row is a real scheme row (0–1). Lower for guesses.
- rawText: original row text when useful for review.
- Skip cover pages, headers-only lines, and footers. Max 80 rows.`;

export function clipPdfTextForExtraction(rawText: string): string {
  if (rawText.length <= SCHEME_PDF_MAX_INPUT_CHARS) return rawText;
  return `${rawText.slice(0, SCHEME_PDF_MAX_INPUT_CHARS)}\n\n[…text truncated for AI…]`;
}

export function buildSchemePdfUserPrompt(clippedText: string): string {
  return `PDF extracted text:\n\n${clippedText}`;
}
