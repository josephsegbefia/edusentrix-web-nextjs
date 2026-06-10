export function normalizeImportLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function compactImportLabel(value: string): string {
  return normalizeImportLabel(value).replace(/\s+/g, "");
}

export function stripOptionalClassPrefix(value: string): string {
  return value
    .trim()
    .replace(/^class\s+(?:group\s+)?/i, "")
    .replace(/^stream\s+/i, "")
    .trim();
}

export type ImportClassGroupRecord = {
  id: string;
  gradeId: string;
  gradeName: string;
  streamName: string;
};

export type StudentImportClassIndex = {
  gradeNameToId: Map<string, string>;
  gradeIdToName: Map<string, string>;
  classesByGradeAndStream: Map<string, ImportClassGroupRecord>;
  classesByGradeAndFullLabel: Map<string, ImportClassGroupRecord>;
  classesByGradeAndStreamSuffix: Map<string, ImportClassGroupRecord>;
  classesByGradeAndCompactName: Map<string, ImportClassGroupRecord>;
  streamsByGradeId: Map<string, ImportClassGroupRecord[]>;
};

/** Derive stream token from stored class group name (e.g. "Creche A" + "Creche" → "A"). */
export function extractStreamSuffix(
  classGroupName: string,
  gradeName: string
): string | null {
  const trimmed = classGroupName.trim();
  const gradeTrimmed = gradeName.trim();
  if (!trimmed) return null;

  if (gradeTrimmed && trimmed.toLowerCase().startsWith(`${gradeTrimmed.toLowerCase()} `)) {
    const suffix = trimmed.slice(gradeTrimmed.length).trim();
    return suffix || null;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return trimmed;
  }

  return parts[parts.length - 1] ?? null;
}

export function buildStudentImportClassIndex(input: {
  grades: { id: string; name: string }[];
  classGroups: { id: string; gradeId: string; name: string }[];
}): StudentImportClassIndex {
  const gradeNameToId = new Map<string, string>();
  const gradeIdToName = new Map<string, string>();

  for (const grade of input.grades) {
    const norm = normalizeImportLabel(grade.name);
    gradeNameToId.set(norm, grade.id);
    gradeIdToName.set(grade.id, grade.name);
  }

  const classesByGradeAndStream = new Map<string, ImportClassGroupRecord>();
  const classesByGradeAndFullLabel = new Map<string, ImportClassGroupRecord>();
  const classesByGradeAndStreamSuffix = new Map<string, ImportClassGroupRecord>();
  const classesByGradeAndCompactName = new Map<string, ImportClassGroupRecord>();
  const streamsByGradeId = new Map<string, ImportClassGroupRecord[]>();

  for (const classGroup of input.classGroups) {
    const gradeName = gradeIdToName.get(classGroup.gradeId);
    if (!gradeName) continue;

    const record: ImportClassGroupRecord = {
      id: classGroup.id,
      gradeId: classGroup.gradeId,
      gradeName,
      streamName: classGroup.name,
    };

    const streamNorm = normalizeImportLabel(classGroup.name);
    classesByGradeAndStream.set(`${classGroup.gradeId}::${streamNorm}`, record);

    const fullLabel = normalizeImportLabel(`${gradeName} ${classGroup.name}`);
    classesByGradeAndFullLabel.set(`${classGroup.gradeId}::${fullLabel}`, record);

    classesByGradeAndCompactName.set(
      `${classGroup.gradeId}::${compactImportLabel(classGroup.name)}`,
      record
    );
    classesByGradeAndCompactName.set(
      `${classGroup.gradeId}::${compactImportLabel(`${gradeName} ${classGroup.name}`)}`,
      record
    );

    const streamSuffix = extractStreamSuffix(classGroup.name, gradeName);
    if (streamSuffix) {
      const suffixNorm = normalizeImportLabel(streamSuffix);
      classesByGradeAndStreamSuffix.set(
        `${classGroup.gradeId}::${suffixNorm}`,
        record
      );
      classesByGradeAndCompactName.set(
        `${classGroup.gradeId}::${compactImportLabel(`${gradeName}${streamSuffix}`)}`,
        record
      );
    }

    const existing = streamsByGradeId.get(classGroup.gradeId) ?? [];
    existing.push(record);
    streamsByGradeId.set(classGroup.gradeId, existing);
  }

  for (const [gradeId, records] of streamsByGradeId) {
    records.sort((a, b) => a.streamName.localeCompare(b.streamName));
    streamsByGradeId.set(gradeId, records);
  }

  return {
    gradeNameToId,
    gradeIdToName,
    classesByGradeAndStream,
    classesByGradeAndFullLabel,
    classesByGradeAndStreamSuffix,
    classesByGradeAndCompactName,
    streamsByGradeId,
  };
}

export function resolveImportGradeId(
  gradeInput: string,
  index: StudentImportClassIndex
): string | null {
  return index.gradeNameToId.get(normalizeImportLabel(gradeInput)) ?? null;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function buildImportClassNameCandidates(
  gradeName: string,
  classInput: string
): string[] {
  const gradeNorm = normalizeImportLabel(gradeName);
  const gradeCompact = compactImportLabel(gradeName);
  const cleaned = stripOptionalClassPrefix(classInput);
  const cleanedNorm = normalizeImportLabel(cleaned);
  const cleanedCompact = compactImportLabel(cleaned);
  const rawNorm = normalizeImportLabel(classInput);

  const candidates: string[] = [
    cleanedNorm,
    rawNorm,
    cleanedCompact,
    `${gradeNorm} ${cleanedNorm}`,
    compactImportLabel(`${gradeName} ${cleaned}`),
  ];

  if (cleanedNorm.startsWith(`${gradeNorm} `)) {
    candidates.push(cleanedNorm.slice(gradeNorm.length).trim());
  }

  if (rawNorm.startsWith(`${gradeNorm} `)) {
    candidates.push(rawNorm.slice(gradeNorm.length).trim());
  }

  if (cleanedCompact.startsWith(gradeCompact) && cleanedCompact.length > gradeCompact.length) {
    const suffix = cleanedCompact.slice(gradeCompact.length);
    candidates.push(suffix);
    candidates.push(`${gradeNorm} ${suffix}`);
  }

  return uniqueStrings(candidates);
}

export function resolveImportClassGroup(input: {
  gradeId: string;
  gradeName: string;
  classInput: string;
  index: StudentImportClassIndex;
}): ImportClassGroupRecord | null {
  const { gradeId, gradeName, classInput, index } = input;
  const candidates = buildImportClassNameCandidates(gradeName, classInput);

  for (const candidate of candidates) {
    const byStream = index.classesByGradeAndStream.get(`${gradeId}::${candidate}`);
    if (byStream) return byStream;

    const byFullLabel = index.classesByGradeAndFullLabel.get(`${gradeId}::${candidate}`);
    if (byFullLabel) return byFullLabel;

    const bySuffix = index.classesByGradeAndStreamSuffix.get(`${gradeId}::${candidate}`);
    if (bySuffix) return bySuffix;

    const byCompact = index.classesByGradeAndCompactName.get(
      `${gradeId}::${compactImportLabel(candidate)}`
    );
    if (byCompact) return byCompact;
  }

  const streams = index.streamsByGradeId.get(gradeId) ?? [];
  for (const candidate of candidates) {
    const candidateNorm = normalizeImportLabel(candidate);
    const candidateCompact = compactImportLabel(candidate);

    for (const record of streams) {
      const streamNorm = normalizeImportLabel(record.streamName);
      const fullLabel = normalizeImportLabel(`${record.gradeName} ${record.streamName}`);
      const suffix = extractStreamSuffix(record.streamName, record.gradeName);

      if (
        candidateNorm === streamNorm ||
        candidateNorm === fullLabel ||
        candidateNorm === normalizeImportLabel(suffix ?? "") ||
        candidateCompact === compactImportLabel(record.streamName) ||
        candidateCompact === compactImportLabel(`${record.gradeName}${suffix ?? ""}`)
      ) {
        return record;
      }
    }
  }

  return null;
}

export function formatAvailableImportGrades(index: StudentImportClassIndex): string {
  return [...index.gradeIdToName.values()]
    .sort((a, b) => a.localeCompare(b))
    .join(", ");
}

export function formatAvailableImportStreams(
  gradeId: string,
  index: StudentImportClassIndex
): string {
  const streams = index.streamsByGradeId.get(gradeId) ?? [];
  if (streams.length === 0) return "none configured";

  return streams.map((record) => record.streamName).join(", ");
}
