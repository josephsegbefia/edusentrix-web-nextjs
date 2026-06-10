import "server-only";

import type { ISchemeImportParsedRow } from "@/models/SchemeImportJob";
import {
  clampSchemeItemShortText,
  clampSchemeItemShortTextOrNull,
} from "@/lib/schemes/scheme-item-field-limits";

const WEEK_ROW_PATTERN = /^(\d{1,2})\s+(\d{2}-\d{2}-\d{4})\s+(.+)$/;
const CONTENT_STANDARD_PATTERN =
  /\b([A-Z]\d+(?:\.\d+){2,}(?:\s*\/\s*[A-Z]\d+(?:\.\d+){2,})*)\b|(?:^|\s)(-)(?=\s)/;
const INDICATOR_START_PATTERN = /^([A-Z]\d+(?:\.\d+){3,})\s+(.+)$/;
const KNOWN_STRANDS = [
  "Statistics and Probability",
  "Geometry and Measurement",
  "Revision and Examination",
  "REVISION AND EXAMINATION",
  "Algebra",
  "Number",
  "Diversity of Matter",
  "Cycles",
  "Systems",
  "Forces and Energy",
  "Humans and the Environment",
  "REVISION",
  "EXAMINATION",
  "CLOSING",
];

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function splitWeekBlocks(rawText: string) {
  const lines = rawText
    .replace(/\u0000/g, "")
    .split(/\r?\n/)
    .map((line) => normalizeSpaces(line))
    .filter(
      (line) =>
        Boolean(line) &&
        !/^note:\s+this sample/i.test(line) &&
        !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line),
    );

  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (WEEK_ROW_PATTERN.test(line)) {
      if (current.length) blocks.push(current);
      current = [line];
    } else if (current.length) {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);
  return blocks;
}

function splitStrandAndSubStrand(value: string) {
  const text = normalizeSpaces(value);
  for (const strand of KNOWN_STRANDS) {
    if (text.toLowerCase().startsWith(strand.toLowerCase())) {
      return {
        strand: strand.toUpperCase() === strand ? strand : strand,
        subStrand: normalizeSpaces(text.slice(strand.length)),
      };
    }
  }

  const [first = "", ...rest] = text.split(" ");
  return { strand: first, subStrand: rest.join(" ") };
}

type TailSection = "indicators" | "activities" | "resources" | "assessment";

function detectTailSection(line: string): TailSection | null {
  // Strip trailing colon and normalize punctuation/spacing for matching.
  const norm = line
    .toLowerCase()
    .trim()
    .replace(/:$/, "")
    .replace(/['']/g, "")   // apostrophes, e.g. "learners' activities"
    .replace(/\s+/g, " ");

  // ── Resources ─────────────────────────────────────────────────────────────
  if (
    /^resources?\b/.test(norm) ||
    /^tlms?\b/.test(norm) ||
    /^teaching\s+(?:learning\s+)?materials?\b/.test(norm) ||
    /^instructional\s+materials?\b/.test(norm) ||
    /^teaching\s+aids?\b/.test(norm) ||
    /^references?\b/.test(norm) ||
    /^ict\s+tools?\b/.test(norm)
  ) {
    return "resources";
  }

  // ── Assessment ─────────────────────────────────────────────────────────────
  if (
    /^assessment\b/.test(norm) ||
    /^evaluations?\b/.test(norm) ||
    /^assessment\s+tasks?\b/.test(norm) ||
    /^evaluation\s+tasks?\b/.test(norm) ||
    /^core\s+tasks?\b/.test(norm) ||
    /^class\s+(?:exercise|work)\b/.test(norm) ||
    /^classwork\b/.test(norm) ||
    /^home\s*work\b/.test(norm) ||
    /^exercises?\b/.test(norm) ||
    /^written\s+exercise\b/.test(norm) ||
    /^oral\s+assessment\b/.test(norm) ||
    /^project\s+work\b/.test(norm) ||
    /^formative\s+assessment\b/.test(norm) ||
    /^summative\s+assessment\b/.test(norm)
  ) {
    return "assessment";
  }

  // ── Teaching & Learning Activities ─────────────────────────────────────────
  if (
    /teaching\s*(?:&|and)\s*learning\s*activit/.test(norm) ||
    /^t\s*(?:&|and)\s*l\s*activit/.test(norm) ||
    /^main\s+activit/.test(norm) ||
    /^activities\b/.test(norm) ||
    /^activity\b/.test(norm) ||
    /^core\s+activit/.test(norm) ||
    /^guided\s+activit/.test(norm) ||
    /^classroom\s+activit/.test(norm) ||
    /^lesson\s+activit/.test(norm) ||
    /^learners?\s+activit/.test(norm) ||
    /^teacher\s+(?:and\s+)?learner\s+activit/.test(norm) ||
    /^teacher\s+activit/.test(norm) ||
    /^group\s+activit/.test(norm) ||
    /^collaborative\s+activit/.test(norm) ||
    /^inquiry\s+activit/.test(norm)
  ) {
    return "activities";
  }

  return null;
}

/**
 * PDF text extractors often collapse a table row into one line. Insert line breaks
 * before indicator codes and known section labels so splitTailColumns can route content.
 */
function expandTailTextToLines(afterStandardText: string): string[] {
  const text = normalizeSpaces(afterStandardText);
  if (!text) return [];

  const withBreaks = text
    .replace(
      /\s+(?=(?:resources?|tlms?|teaching\s+(?:&|and)\s*learning|learners?\s+activit|guided\s+activit|core\s+activit|main\s+activit|classwork|homework|assessment|evaluation|core\s+tasks?)\b)/gi,
      "\n",
    )
    .replace(/\s+(?=(?:B\d+(?:\.\d+){3,})\b)/gi, "\n");

  return withBreaks
    .split(/\n/)
    .map(normalizeSpaces)
    .filter(Boolean);
}

function splitTailColumns(lines: string[]) {
  const indicators: string[] = [];
  const learningOutcomes: string[] = [];
  const activities: string[] = [];
  const resources: string[] = [];
  const assessment: string[] = [];

  let section: TailSection = "indicators";
  let currentIndicator = "";

  const pushIndicator = () => {
    const text = normalizeSpaces(currentIndicator);
    if (!text) return;
    if (INDICATOR_START_PATTERN.test(text)) {
      indicators.push(text);
    } else {
      learningOutcomes.push(text);
    }
    currentIndicator = "";
  };

  for (const rawLine of lines) {
    const line = normalizeSpaces(rawLine);
    if (!line) continue;

    const detected = detectTailSection(line);
    if (detected) {
      pushIndicator();
      section = detected;
      continue;
    }

    const indicatorMatch = line.match(INDICATOR_START_PATTERN);
    if (indicatorMatch && section === "indicators") {
      pushIndicator();
      currentIndicator = `${indicatorMatch[1]} ${indicatorMatch[2]}`;
      continue;
    }

    if (section === "indicators") {
      if (currentIndicator && /[.!?]$/.test(currentIndicator)) {
        pushIndicator();
        learningOutcomes.push(line);
      } else if (currentIndicator) {
        currentIndicator = normalizeSpaces(`${currentIndicator} ${line}`);
      } else if (indicatorMatch) {
        currentIndicator = line;
      } else {
        learningOutcomes.push(line);
      }
      continue;
    }

    if (section === "activities") activities.push(line);
    else if (section === "resources") resources.push(line);
    else if (section === "assessment") assessment.push(line);
  }

  pushIndicator();

  return {
    indicators,
    learningOutcomes,
    teachingLearningActivities: activities.length ? activities.join("\n") : null,
    resources: resources.map(normalizeSpaces).filter(Boolean),
    assessment: assessment.map(normalizeSpaces).filter(Boolean),
  };
}

function parseWeekBlock(block: string[], index: number): ISchemeImportParsedRow | null {
  const firstLineMatch = block[0]?.match(WEEK_ROW_PATTERN);
  if (!firstLineMatch) return null;

  const weekNumber = Number.parseInt(firstLineMatch[1], 10);
  const weekEnding = firstLineMatch[2];
  const firstRest = firstLineMatch[3];
  const contentLines = [firstRest, ...block.slice(1)];
  const contentText = contentLines.join("\n");
  const contentMatch = contentText.match(CONTENT_STANDARD_PATTERN);
  if (!contentMatch || contentMatch.index == null) return null;

  const beforeStandard = normalizeSpaces(contentText.slice(0, contentMatch.index));
  const contentStandardRaw = contentMatch[1] ?? contentMatch[2] ?? "";
  const contentStandard = contentStandardRaw === "-" ? null : normalizeSpaces(contentStandardRaw);
  const afterStandardText = contentText.slice(contentMatch.index + contentMatch[0].length);
  const afterStandardLines = expandTailTextToLines(afterStandardText);

  const { strand, subStrand } = splitStrandAndSubStrand(beforeStandard);
  const rowType =
    /revision|examination|assessment/i.test(`${strand} ${subStrand} ${afterStandardText}`)
      ? "examination"
      : "teaching";
  const tail = splitTailColumns(afterStandardLines);
  const titleSource =
    subStrand ||
    strand ||
    tail.indicators[0] ||
    tail.learningOutcomes[0] ||
    `Week ${weekNumber}`;
  const title = clampSchemeItemShortText(titleSource);
  if (!title) return null;

  return {
    rowIndex: index + 2,
    weekNumber: Number.isFinite(weekNumber) ? weekNumber : null,
    weekEnding,
    title,
    strand: clampSchemeItemShortTextOrNull(strand),
    subStrand: clampSchemeItemShortTextOrNull(subStrand),
    contentStandard,
    indicators: tail.indicators,
    learningOutcomes: tail.learningOutcomes,
    teachingLearningActivities: tail.teachingLearningActivities,
    resources: tail.resources,
    assessment: tail.assessment,
    learningObjective: null,
    notes: null,
    rowType,
    skipped: false,
    errors:
      Number.isFinite(weekNumber) && weekNumber >= 1 && weekNumber <= 53
        ? []
        : ["Week must be between 1 and 53"],
    confidence: 0.72,
    rawText: block.join("\n"),
  };
}

export function parseSchemeRowsFromPdfTextManually(rawText: string): ISchemeImportParsedRow[] {
  return splitWeekBlocks(rawText)
    .map(parseWeekBlock)
    .filter((row): row is ISchemeImportParsedRow => Boolean(row))
    .slice(0, 80);
}
