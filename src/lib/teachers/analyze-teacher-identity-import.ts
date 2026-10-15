import mongoose from "mongoose";
import type {
  ITeacherImportAnalysisSummary,
  ITeacherImportColumnMapping,
  ITeacherImportIssue,
  ITeacherImportParsedRow,
} from "@/models/TeacherImportJob";
import {
  parseTeacherIdentityImportWorkbook,
  parseTeacherImportWorkbook,
  TEACHER_IDENTITY_CANONICAL_FIELDS,
  type TeacherImportParseOptions,
} from "@/lib/teachers/parse-teacher-import";
import { suggestTeacherImportHeaders } from "@/lib/teachers/teacher-import-leo";
import type { ImportLeoMetadata } from "@/lib/leo/import-completion";

const IDENTITY_FIELDS = new Set<string>(TEACHER_IDENTITY_CANONICAL_FIELDS);

type IdentityAnalysisResult = {
  selectedSheetName: string | null;
  availableSheets: Array<{ name: string; score: number; rowCount: number; signals: string[] }>;
  sheetSelectionRequired: boolean;
  columnMappings: ITeacherImportColumnMapping[];
  parsedRows: ITeacherImportParsedRow[];
  subjectResolutions: [];
  classResolutions: [];
  analysisSummary: ITeacherImportAnalysisSummary;
  analysisWarnings: ITeacherImportIssue[];
  analysisErrors: ITeacherImportIssue[];
  leoAnalysis?: ImportLeoMetadata | null;
};

function headerSignals(sheet: { headers: string[]; rows: Array<{ values: Record<string, string> }> } | undefined) {
  if (!sheet) return [];
  return sheet.headers.map((sourceHeader) => {
    const values = sheet.rows.map((row) => row.values[sourceHeader]).filter(Boolean).slice(0, 100);
    const valueKinds = new Set<string>();
    for (const value of values) {
      if (/^[+\d][\d\s().-]{6,}$/.test(value)) valueKinds.add("phone-like");
      else if (/^\S+@\S+\.\S+$/.test(value)) valueKinds.add("email-like");
      else if (/^\d+$/.test(value)) valueKinds.add("numeric");
      else if (value.split(/\s+/).length > 1) valueKinds.add("multi-word text");
      else valueKinds.add("text");
    }
    return { sourceHeader, nonEmptyCount: values.length, valueKinds: [...valueKinds].sort() };
  });
}

function identityMappings(
  base: ITeacherImportColumnMapping[],
  suggestions: Array<{ sourceHeader: string; canonicalField: string | null; confidence: number }>
) {
  const byHeader = new Map(suggestions.map((item) => [item.sourceHeader, item]));
  return base.map((mapping) => {
    const suggestion = byHeader.get(mapping.sourceHeader);
    if (suggestion) {
      const canonicalField = IDENTITY_FIELDS.has(suggestion.canonicalField || "")
        ? suggestion.canonicalField
        : null;
      return {
        ...mapping,
        canonicalField,
        source: "leo" as const,
        confidence: suggestion.confidence,
        status: canonicalField ? "resolved" as const : "ignored" as const,
      };
    }
    if (!IDENTITY_FIELDS.has(mapping.canonicalField || "")) {
      return { ...mapping, canonicalField: null, status: "ignored" as const };
    }
    return mapping;
  });
}

export async function analyzeTeacherIdentityImport(input: {
  schoolId: mongoose.Types.ObjectId;
  fileName: string;
  fileBytes: Buffer;
  selectedSheetName?: string | null;
  columnMappings?: ITeacherImportColumnMapping[];
}): Promise<IdentityAnalysisResult> {
  const initial = parseTeacherImportWorkbook(input.fileBytes, input.fileName, {
    selectedSheetName: input.selectedSheetName,
    columnMappings: input.columnMappings,
  } satisfies TeacherImportParseOptions);
  const selectedSheet = initial.sheets.find((sheet) => sheet.name === initial.selectedSheetName);
  let mappings = initial.columnMappings;
  let leoAnalysis: ImportLeoMetadata | null = null;

  if (!input.columnMappings?.length && selectedSheet) {
    const leo = await suggestTeacherImportHeaders({
      schoolId: input.schoolId,
      unresolvedHeaders: selectedSheet.headers,
      headerSignals: headerSignals(selectedSheet),
    });
    if (leo.ok) {
      mappings = identityMappings(mappings, leo.suggestions);
      leoAnalysis = leo.metadata || null;
    } else {
      mappings = identityMappings(mappings, []);
      leoAnalysis = leo.metadata || null;
    }
  } else {
    mappings = identityMappings(mappings, []);
  }

  const parsed = parseTeacherIdentityImportWorkbook(input.fileBytes, input.fileName, {
    selectedSheetName: input.selectedSheetName,
    columnMappings: mappings,
  });
  const rows = parsed.rows.map((row) => ({ ...row }));
  const analysisWarnings: ITeacherImportIssue[] = [];
  const analysisErrors: ITeacherImportIssue[] = [];
  const missingNameRows = rows.filter((row) => !row.firstName || !row.lastName);
  if (missingNameRows.length) {
    analysisWarnings.push({
      code: "name_setup_required",
      message: `${missingNameRows.length} teacher${missingNameRows.length === 1 ? "" : "s"} need name correction in the setup wizard.`,
      field: "name",
      value: null,
      affectedRows: missingNameRows.map((row) => row.sourceRowNumber),
    });
  }

  return {
    selectedSheetName: parsed.selectedSheetName,
    availableSheets: parsed.sheets.map(({ name, score, rows: sheetRows, signals }) => ({ name, score, rowCount: sheetRows.length, signals })),
    sheetSelectionRequired: parsed.sheetSelectionRequired,
    columnMappings: mappings,
    parsedRows: rows,
    subjectResolutions: [],
    classResolutions: [],
    analysisSummary: {
      totalRows: rows.length,
      readyRows: rows.filter((row) => row.firstName && row.lastName).length,
      needsReviewRows: missingNameRows.length,
      blockedRows: 0,
      existingRows: 0,
      mappedColumns: mappings.filter((mapping) => mapping.canonicalField && IDENTITY_FIELDS.has(mapping.canonicalField)).length,
      resolvedSubjectAliases: 0,
      resolvedClassAliases: 0,
      warnings: analysisWarnings.length,
      errors: analysisErrors.length,
      leoUsed: Boolean(leoAnalysis),
      leoUnavailable: !leoAnalysis,
    },
    analysisWarnings,
    analysisErrors,
    leoAnalysis,
  };
}
