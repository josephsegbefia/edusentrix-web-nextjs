export function normHintText(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function compactHintText(s: string) {
  return normHintText(s).replace(/\s+/g, "");
}

export type GradeLite = { id: string; name: string };

export type OfferingMatchLite = {
  id: string;
  subjectId: string;
  displayName: string;
  shortName: string;
  code: string;
  subjectFamily: string;
  gradeBand: string;
  gradeIds: string[];
};

export type ParsedAssignmentRow = {
  subject: string;
  grade: string;
  stream: string;
};

export type GradeStreamConstraint =
  | { mode: "all" }
  | { mode: "explicit"; streams: Set<string> };

/** Case-insensitive stream tokens the user named for each grade id. */
export function buildGradeStreamConstraints(
  hint: string,
  grades: GradeLite[]
): Map<string, GradeStreamConstraint> {
  const h = normHintText(hint);
  const constraints = new Map<string, GradeStreamConstraint>();
  const sorted = [...grades].sort(
    (a, b) => compactHintText(b.name).length - compactHintText(a.name).length
  );

  for (const grade of sorted) {
    const gNorm = normHintText(grade.name);
    const gCompact = compactHintText(grade.name);
    let idx = h.indexOf(gNorm);
    let matchedLen = gNorm.length;

    if (idx === -1) {
      idx = h.indexOf(gCompact);
      matchedLen = gCompact.length;
    }

    if (idx === -1) continue;

    let suffix = h.slice(idx + matchedLen);

    // Fused tail on compact grade token: "jhs1a" → stream "a"
    const fused = h.slice(idx).match(
      new RegExp(
        `^${escapeRegExp(gCompact)}([a-z0-9]{1,4})(?:\\s|$|[^a-z0-9])`,
        "i"
      )
    );
    if (fused?.[1] && suffix.trim().length === 0) {
      constraints.set(grade.id, {
        mode: "explicit",
        streams: new Set([fused[1].toLowerCase()]),
      });
      continue;
    }

    const streams = parseStreamsFromSuffix(suffix);
    if (streams === null) {
      constraints.set(grade.id, { mode: "all" });
    } else {
      constraints.set(grade.id, {
        mode: "explicit",
        streams: new Set(streams.map((s) => s.toLowerCase())),
      });
    }
  }

  return constraints;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseStreamsFromSuffix(suffix: string): string[] | null {
  let s = suffix.trim().replace(/^[\s,.:;/-]+/, "");
  if (!s) return null;

  s = s.replace(/^(?:stream|streams|class|classes|form)\s+/i, "");

  if (/\band\b/i.test(s)) {
    const parts = s
      .split(/\s+and\s+/i)
      .map((part) => part.trim())
      .filter(Boolean);
    const streams = parts
      .map((part) => part.replace(/[^a-z0-9]/gi, "").toLowerCase())
      .filter(Boolean);
    if (streams.length > 0) return streams;
  }

  if (/,/.test(s)) {
    const streams = s
      .split(",")
      .map((part) => part.trim().replace(/[^a-z0-9]/gi, "").toLowerCase())
      .filter(Boolean);
    if (streams.length > 0) return streams;
  }

  const single = s.match(/^([a-z0-9]{1,6})\b/i);
  if (single?.[1]) return [single[1].toLowerCase()];

  return null;
}

export function extractStreamToken(
  classGroupName: string,
  gradeName: string
): string {
  const cn = normHintText(classGroupName);
  const gn = normHintText(gradeName);
  const gCompact = compactHintText(gradeName);

  if (cn.startsWith(`${gn} `)) {
    return cn.slice(gn.length + 1).trim();
  }
  if (cn.startsWith(gCompact) && cn.length > gCompact.length) {
    return cn
      .slice(gCompact.length)
      .trim()
      .replace(/^[\s\-–—]+/, "");
  }
  const parts = cn.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? cn;
}

export function rowMatchesStreamConstraint(args: {
  gradeId: string;
  streamRaw: string;
  classGroupName: string;
  gradeName: string;
  constraints: Map<string, GradeStreamConstraint>;
}): boolean {
  const constraint = args.constraints.get(args.gradeId);
  if (!constraint || constraint.mode === "all") return true;

  const tokens = new Set<string>([
    normHintText(args.streamRaw),
    compactHintText(args.streamRaw),
    normHintText(extractStreamToken(args.classGroupName, args.gradeName)),
    compactHintText(extractStreamToken(args.classGroupName, args.gradeName)),
  ]);

  for (const wanted of constraint.streams) {
    const wNorm = normHintText(wanted);
    const wCompact = compactHintText(wanted);
    if (tokens.has(wNorm) || tokens.has(wCompact)) return true;
  }
  return false;
}

function scoreSubjectAlias(name: string, offering: OfferingMatchLite): number {
  const variants = [
    offering.displayName,
    offering.shortName,
    offering.code,
    offering.subjectFamily,
  ].filter(Boolean);

  const n = normHintText(name);
  const c = compactHintText(name);

  for (const variant of variants) {
    const vn = normHintText(variant);
    const vc = compactHintText(variant);
    if (vn === n || vc === c) return 100;
    if (vn.includes(n) || n.includes(vn)) return 80;
    if (vc.includes(c) || c.includes(vc)) return 75;
  }

  if (c === "math" || c === "maths") {
    for (const variant of variants) {
      if (compactHintText(variant).includes("math")) return 70;
    }
  }
  if (c === "science" || c === "sci") {
    for (const variant of variants) {
      if (compactHintText(variant).includes("science")) return 70;
    }
  }
  if (c === "english" || c === "eng") {
    for (const variant of variants) {
      if (compactHintText(variant).includes("english")) return 70;
    }
  }

  return 0;
}

function scoreOfferingForGrade(
  offering: OfferingMatchLite,
  gradeId: string,
  gradeName: string
): number {
  let score = 0;
  const gn = normHintText(gradeName);
  const gCompact = compactHintText(gradeName);
  const dn = normHintText(offering.displayName);
  const dnCompact = compactHintText(offering.displayName);

  if (offering.gradeIds.includes(gradeId)) score += 40;
  if (dn.includes(gn) || dnCompact.includes(gCompact)) score += 35;
  if (gn.includes("jhs") && offering.gradeBand === "jhs") score += 25;
  if (gn.includes("primary") && offering.gradeBand.includes("primary")) score += 25;
  if (gn.includes("kg") && offering.gradeBand === "preschool") score += 20;

  return score;
}

export function bestOfferingForGrade(
  subjectHint: string,
  gradeId: string,
  gradeName: string,
  offerings: OfferingMatchLite[]
): OfferingMatchLite | null {
  const scoped = offerings.filter(
    (offering) =>
      offering.gradeIds.length === 0 || offering.gradeIds.includes(gradeId)
  );
  if (scoped.length === 0) return null;

  let best: OfferingMatchLite | null = null;
  let bestScore = 0;

  for (const offering of scoped) {
    const score =
      scoreSubjectAlias(subjectHint, offering) +
      scoreOfferingForGrade(offering, gradeId, gradeName);
    if (score > bestScore) {
      bestScore = score;
      best = offering;
    }
  }

  return bestScore > 0 ? best : null;
}

export function bestGradeMatch(
  name: string,
  gradeByNorm: Map<string, GradeLite>
): GradeLite | null {
  const n = normHintText(name);
  if (gradeByNorm.has(n)) return gradeByNorm.get(n)!;
  const c = compactHintText(name);
  for (const [k, v] of gradeByNorm) {
    if (compactHintText(k) === c) return v;
  }
  for (const [k, v] of gradeByNorm) {
    if (k.includes(n) || n.includes(k)) return v;
  }
  return null;
}

const SUBJECT_KEYWORDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bmathematics\b/i, label: "Mathematics" },
  { pattern: /\bmaths?\b/i, label: "Mathematics" },
  { pattern: /\bintegrated science\b/i, label: "Integrated Science" },
  { pattern: /\bscience\b/i, label: "Science" },
  { pattern: /\benglish\b/i, label: "English" },
  { pattern: /\bsocial studies\b/i, label: "Social Studies" },
  { pattern: /\brme\b/i, label: "RME" },
  { pattern: /\bict\b/i, label: "ICT" },
];

export function extractSubjectPhrase(hint: string, gradeName: string): string {
  for (const { pattern, label } of SUBJECT_KEYWORDS) {
    if (pattern.test(hint)) return label;
  }

  let h = normHintText(hint);
  h = h.replace(normHintText(gradeName), " ");
  h = h.replace(compactHintText(gradeName), " ");
  h = h.replace(
    /\b(in|and|teaches|teaching|for|stream|streams|class|classes|form)\b/g,
    " "
  );
  h = h.replace(/\s+[a-z0-9]{1,4}\s*$/i, " ");
  h = h.replace(/\s+/g, " ").trim();
  return h;
}

/** Deterministic parse for simple hints like "math in JHS 1 A". */
export function tryDeterministicAssignments(
  hint: string,
  grades: GradeLite[],
  constraints: Map<string, GradeStreamConstraint>
): ParsedAssignmentRow[] {
  const rows: ParsedAssignmentRow[] = [];

  for (const grade of grades) {
    const constraint = constraints.get(grade.id);
    if (!constraint) continue;

    const gNorm = normHintText(grade.name);
    const gCompact = compactHintText(grade.name);
    const h = normHintText(hint);
    if (!h.includes(gNorm) && !h.includes(gCompact)) continue;

    const subject = extractSubjectPhrase(hint, grade.name);
    if (!subject) continue;

    if (constraint.mode === "all") {
      continue;
    }

    for (const stream of constraint.streams) {
      rows.push({
        subject,
        grade: grade.name,
        stream,
      });
    }
  }

  return rows;
}

export function expandAllStreamAssignments(
  hint: string,
  grades: GradeLite[],
  constraints: Map<string, GradeStreamConstraint>,
  classGroups: Array<{ name: string; gradeId: string }>
): ParsedAssignmentRow[] {
  const rows: ParsedAssignmentRow[] = [];
  const h = normHintText(hint);

  for (const grade of grades) {
    const constraint = constraints.get(grade.id);
    if (!constraint || constraint.mode !== "all") continue;

    const gNorm = normHintText(grade.name);
    const gCompact = compactHintText(grade.name);
    if (!h.includes(gNorm) && !h.includes(gCompact)) continue;

    const subject = extractSubjectPhrase(hint, grade.name);
    if (!subject) continue;

    const groups = classGroups.filter((cg) => cg.gradeId === grade.id);
    for (const cg of groups) {
      rows.push({
        subject,
        grade: grade.name,
        stream: extractStreamToken(cg.name, grade.name),
      });
    }
  }

  return rows;
}

export function buildConfirmationText(
  labels: string[],
  unmatched: string[]
): string {
  if (labels.length === 0) {
    return unmatched.length
      ? "I couldn't match part of your note to your school's classes."
      : "Review the assignments below, then accept or dismiss.";
  }
  return `This teacher will be assigned to ${labels
    .map((label) => label.replace(" · ", " in "))
    .join("; ")}.`;
}
