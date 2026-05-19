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

function splitIndicatorsAndResources(lines: string[]) {
  const indicators: string[] = [];
  const resources: string[] = [];
  let currentIndicator = "";
  let resourcesStarted = false;

  const pushIndicator = () => {
    const text = normalizeSpaces(currentIndicator);
    if (text) indicators.push(text);
    currentIndicator = "";
  };

  for (const line of lines.map(normalizeSpaces).filter(Boolean)) {
    const indicatorMatch = line.match(INDICATOR_START_PATTERN);
    if (indicatorMatch && !resourcesStarted) {
      pushIndicator();
      currentIndicator = `${indicatorMatch[1]} ${indicatorMatch[2]}`;
      continue;
    }

    if (!resourcesStarted && currentIndicator && !indicatorMatch) {
      if (/[.!?]$/.test(currentIndicator)) {
        pushIndicator();
        resourcesStarted = true;
        resources.push(line);
      } else {
        currentIndicator = normalizeSpaces(`${currentIndicator} ${line}`);
      }
      continue;
    }

    resourcesStarted = true;
    resources.push(line);
  }

  pushIndicator();
  return {
    indicators,
    resources: resources.map(normalizeSpaces).filter(Boolean),
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
  const afterStandardLines = afterStandardText
    .split(/\n/)
    .map(normalizeSpaces)
    .filter(Boolean);

  const { strand, subStrand } = splitStrandAndSubStrand(beforeStandard);
  const rowType =
    /revision|examination|assessment/i.test(`${strand} ${subStrand} ${afterStandardText}`)
      ? "examination"
      : "teaching";
  const { indicators, resources } = splitIndicatorsAndResources(afterStandardLines);
  const notes = indicators.length
    ? null
    : normalizeSpaces(afterStandardLines.join(" ")) || null;
  const titleSource = subStrand || strand || indicators[0] || notes || `Week ${weekNumber}`;
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
    indicators,
    resources,
    learningObjective: indicators.length ? indicators.join("\n") : null,
    notes,
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
