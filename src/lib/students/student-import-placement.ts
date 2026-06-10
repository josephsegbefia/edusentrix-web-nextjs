import {
  compactImportLabel,
  normalizeImportLabel,
  resolveImportClassGroup,
  type ImportClassGroupRecord,
  type StudentImportClassIndex,
} from "@/lib/students/student-import-class-resolution";

export type StudentImportPlacement =
  | {
      ok: true;
      gradeId: string;
      gradeName: string;
      classGroup: ImportClassGroupRecord;
    }
  | { ok: false; message: string };

function resolveImportGradeRecord(input: {
  gradeInput: string;
  classInput?: string;
  index: StudentImportClassIndex;
}):
  | { kind: "found"; gradeId: string; gradeName: string }
  | { kind: "ambiguous"; options: string[] }
  | { kind: "not_found" } {
  const { gradeInput, classInput, index } = input;
  const gradeNorm = normalizeImportLabel(gradeInput);
  const gradeCompact = compactImportLabel(gradeInput);

  const exactId = index.gradeNameToId.get(gradeNorm);
  if (exactId) {
    return {
      kind: "found",
      gradeId: exactId,
      gradeName: index.gradeIdToName.get(exactId)!,
    };
  }

  for (const [gradeId, gradeName] of index.gradeIdToName) {
    if (compactImportLabel(gradeName) === gradeCompact) {
      return { kind: "found", gradeId, gradeName };
    }
  }

  if (classInput?.trim()) {
    const fromClass = resolveUniqueClassGroupAcrossGrades(classInput, index);
    if (fromClass) {
      return {
        kind: "found",
        gradeId: fromClass.gradeId,
        gradeName: fromClass.gradeName,
      };
    }
  }

  const prefixMatches = [...index.gradeIdToName.entries()].filter(([_, gradeName]) => {
    const nameCompact = compactImportLabel(gradeName);
    return (
      nameCompact === gradeCompact ||
      nameCompact.startsWith(gradeCompact) ||
      gradeCompact.startsWith(nameCompact)
    );
  });

  if (prefixMatches.length === 1) {
    const [gradeId, gradeName] = prefixMatches[0];
    return { kind: "found", gradeId, gradeName };
  }

  if (prefixMatches.length > 1 && classInput?.trim()) {
    const matchedGrades: { gradeId: string; gradeName: string }[] = [];
    for (const [gradeId, gradeName] of prefixMatches) {
      const classGroup = resolveImportClassGroup({
        gradeId,
        gradeName,
        classInput,
        index,
      });
      if (classGroup) {
        matchedGrades.push({ gradeId, gradeName });
      }
    }
    if (matchedGrades.length === 1) {
      const only = matchedGrades[0];
      return { kind: "found", gradeId: only.gradeId, gradeName: only.gradeName };
    }
    if (matchedGrades.length > 1) {
      return {
        kind: "ambiguous",
        options: matchedGrades.map((g) => g.gradeName),
      };
    }
  }

  if (prefixMatches.length > 1) {
    return {
      kind: "ambiguous",
      options: prefixMatches.map(([, gradeName]) => gradeName),
    };
  }

  return { kind: "not_found" };
}

export function resolveUniqueClassGroupAcrossGrades(
  classInput: string,
  index: StudentImportClassIndex
): ImportClassGroupRecord | null {
  const matches: ImportClassGroupRecord[] = [];

  for (const [gradeId, gradeName] of index.gradeIdToName) {
    const classGroup = resolveImportClassGroup({
      gradeId,
      gradeName,
      classInput,
      index,
    });
    if (classGroup) {
      matches.push(classGroup);
    }
  }

  const uniqueById = new Map(matches.map((record) => [record.id, record]));
  if (uniqueById.size === 1) {
    return [...uniqueById.values()][0] ?? null;
  }

  return null;
}

/** Infer grade/class when one column holds a full label like "Primary 1 A". */
export function inferGradeAndClassFromCombinedLabel(input: {
  gradeInput?: string;
  classInput?: string;
  index: StudentImportClassIndex;
}): { gradeName: string; className: string } | null {
  const gradeInput = input.gradeInput?.trim() ?? "";
  const classInput = input.classInput?.trim() ?? "";

  if (gradeInput && classInput) {
    return { gradeName: gradeInput, className: classInput };
  }

  const combined = classInput || gradeInput;
  if (!combined) return null;

  const globalMatch = resolveUniqueClassGroupAcrossGrades(combined, input.index);
  if (globalMatch) {
    const suffix =
      globalMatch.streamName.toLowerCase().startsWith(globalMatch.gradeName.toLowerCase())
        ? globalMatch.streamName.slice(globalMatch.gradeName.length).trim() ||
          globalMatch.streamName
        : globalMatch.streamName;
    return {
      gradeName: globalMatch.gradeName,
      className: suffix,
    };
  }

  for (const gradeName of indexGradeNamesSortedLongestFirst(input.index)) {
    const gradeNorm = normalizeImportLabel(gradeName);
    const combinedNorm = normalizeImportLabel(combined);
    const combinedCompact = compactImportLabel(combined);

    if (
      combinedNorm.startsWith(`${gradeNorm} `) ||
      combinedCompact.startsWith(compactImportLabel(gradeName))
    ) {
      const className = combinedNorm.startsWith(`${gradeNorm} `)
        ? combined.slice(gradeName.length).trim()
        : combined.slice(gradeName.length).trim();
      if (className) {
        return { gradeName, className };
      }
    }
  }

  return null;
}

function indexGradeNamesSortedLongestFirst(
  index: StudentImportClassIndex
): string[] {
  return [...index.gradeIdToName.values()].sort(
    (a, b) => b.length - a.length
  );
}

export function resolveStudentImportPlacement(input: {
  gradeInput?: string;
  classInput?: string;
  index: StudentImportClassIndex;
}): StudentImportPlacement {
  const inferred = inferGradeAndClassFromCombinedLabel({
    gradeInput: input.gradeInput,
    classInput: input.classInput,
    index: input.index,
  });

  const gradeName = inferred?.gradeName ?? input.gradeInput?.trim() ?? "";
  const className = inferred?.className ?? input.classInput?.trim() ?? "";

  if (!gradeName && !className) {
    return { ok: false, message: "Grade and class group are required" };
  }

  if (!className) {
    return { ok: false, message: "Class group is required (e.g. A, B, or Creche A)" };
  }

  if (!gradeName) {
    const globalMatch = resolveUniqueClassGroupAcrossGrades(className, input.index);
    if (!globalMatch) {
      return {
        ok: false,
        message:
          "Grade is missing and the class group could not be matched uniquely. Add a Grade column or use a full class label like Primary 1 A.",
      };
    }
    return { ok: true, gradeId: globalMatch.gradeId, gradeName: globalMatch.gradeName, classGroup: globalMatch };
  }

  const gradeRecord = resolveImportGradeRecord({
    gradeInput: gradeName,
    classInput: className,
    index: input.index,
  });

  if (gradeRecord.kind === "ambiguous") {
    return {
      ok: false,
      message: `Grade "${gradeName}" is ambiguous. Did you mean: ${gradeRecord.options.sort((a, b) => a.localeCompare(b)).join(", ")}?`,
    };
  }

  if (gradeRecord.kind === "not_found") {
    return {
      ok: false,
      message: `Grade "${gradeName}" not found. Available grades: ${[...input.index.gradeIdToName.values()].sort((a, b) => a.localeCompare(b)).join(", ")}`,
    };
  }

  const classGroup = resolveImportClassGroup({
    gradeId: gradeRecord.gradeId,
    gradeName: gradeRecord.gradeName,
    classInput: className,
    index: input.index,
  });

  if (!classGroup) {
    const available =
      input.index.streamsByGradeId.get(gradeRecord.gradeId)?.map((r) => r.streamName).join(", ") ??
      "none configured";
    return {
      ok: false,
      message: `Could not match class "${className}" for grade "${gradeRecord.gradeName}". Available class groups: ${available}`,
    };
  }

  return {
    ok: true,
    gradeId: gradeRecord.gradeId,
    gradeName: gradeRecord.gradeName,
    classGroup,
  };
}
