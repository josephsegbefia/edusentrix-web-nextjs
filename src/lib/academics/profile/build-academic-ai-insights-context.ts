import { trendSourceLabel } from "@/lib/academics/profile/academic-trends-view-utils";
import type { StudentAcademicProfileDTO } from "@/types/academics/student-academic-profile";

function formatNullable(value: string | number | null | undefined, suffix = "") {
  if (value == null || value === "") {
    return "Not available";
  }
  return `${value}${suffix}`;
}

function formatScore(value: number | null | undefined, suffix = "%") {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Not available";
  }
  return `${value.toFixed(1)}${suffix}`;
}

export function profileHasAcademicInsightData(profile: StudentAcademicProfileDTO) {
  return (
    profile.subjectResults.length > 0 ||
    profile.summary.finalAverage != null ||
    profile.summary.projectedAverage != null ||
    profile.summary.overallAverage != null ||
    profile.trends.termHistory.some((point) => point.averageScore != null)
  );
}

/**
 * Builds a factual Leo prompt context from the academic profile.
 * Omits sections with no data — does not invent values.
 */
export function buildAcademicAIInsightsContext(
  profile: StudentAcademicProfileDTO,
  studentName: string
): string {
  const lines: string[] = [
    "STUDENT ACADEMIC PROFILE CONTEXT",
    "Use only the facts below. Do not invent scores, comments, attendance, or report status.",
    "",
    `Student: ${studentName || "Unknown"}`,
    `Academic period: ${profile.selectedPeriod.label ?? "Not available"}`,
    `Insight mode: ${profile.aiInsights.mode}`,
    `Data source: ${profile.dataSource}`,
    `Record status: ${profile.recordStatus}`,
    `Report status: ${profile.reportStatus.label}${
      profile.reportStatus.isReleased ? " (released)" : ""
    }`,
  ];

  const averageLine = profile.reportStatus.isReleased
    ? `Final average: ${formatScore(profile.summary.finalAverage ?? profile.summary.overallAverage)}`
    : profile.permissions.canViewProjectedAverage
      ? `Projected average: ${formatScore(
          profile.summary.projectedAverage ?? profile.summary.overallAverage
        )}`
      : `Overall average: ${formatScore(profile.summary.overallAverage)}`;

  lines.push(
    "",
    "SUMMARY",
    averageLine,
    `Class position: ${formatNullable(profile.summary.classPosition)} of ${formatNullable(profile.summary.totalStudents)}`,
    `Performance tier: ${formatNullable(profile.summary.performanceTier)}`,
    `Trend: ${profile.summary.trend}${
      profile.summary.trendDelta != null
        ? ` (${profile.summary.trendDelta > 0 ? "+" : ""}${profile.summary.trendDelta.toFixed(1)} pts)`
        : ""
    }`,
    `Risk level: ${formatNullable(profile.summary.riskLevel)}`
  );

  if (profile.permissions.canViewReadiness && profile.reportStatus.readiness) {
    const readiness = profile.reportStatus.readiness;
    lines.push(
      "",
      "REPORT READINESS (staff)",
      `Subjects submitted: ${readiness.subjectsSubmitted} / ${readiness.subjectsExpected}`,
      `Attendance ready: ${readiness.attendanceReady ? "Yes" : "No"}`,
      `Comments ready: ${readiness.commentsReady ? "Yes" : "No"}`
    );
    if (readiness.missingSubjects.length > 0) {
      lines.push(
        `Missing subjects: ${readiness.missingSubjects
          .map((entry) => entry.subjectName)
          .join(", ")}`
      );
    }
    if (readiness.issues.length > 0) {
      lines.push(
        "Readiness issues:",
        ...readiness.issues.map((issue) => `- ${issue.message}`)
      );
    }
  }

  if (profile.subjectResults.length > 0) {
    lines.push("", "SUBJECT RESULTS");
    for (const subject of profile.subjectResults) {
      const componentSummary =
        subject.components.length > 0
          ? subject.components
              .map(
                (component) =>
                  `${component.label} (${component.weight}%): ${formatScore(
                    component.weightedScore ?? component.rawPercentage
                  )}`
              )
              .join("; ")
          : "No component breakdown";

      lines.push(
        `- ${subject.subjectName}: total ${formatScore(
          subject.roundedFinalScore ?? subject.finalScore
        )}, grade ${formatNullable(subject.gradeLabel)}, status ${subject.status}${
          subject.isOfficial ? " (official)" : " (provisional)"
        }`,
        `  Components: ${componentSummary}`
      );
      if (subject.remark) {
        lines.push(`  Teacher remark: ${subject.remark}`);
      }
    }
  } else {
    lines.push("", "SUBJECT RESULTS", "No subject results available.");
  }

  const evidence = profile.assessmentEvidenceSummary;
  if (
    evidence.countedItemsTotal > 0 ||
    evidence.nonCountedItemsTotal > 0 ||
    evidence.missingItemsTotal > 0
  ) {
    lines.push(
      "",
      "ASSESSMENT EVIDENCE SUMMARY",
      `Counted assessment items: ${evidence.countedItemsTotal}`,
      `Non-counted items: ${evidence.nonCountedItemsTotal}`,
      `Missing required items: ${evidence.missingItemsTotal}`
    );
    if (evidence.subjectsWithMissingEvidence.length > 0) {
      lines.push(
        "Subjects with missing evidence:",
        ...evidence.subjectsWithMissingEvidence.map(
          (entry) => `- ${entry.subjectName}: ${entry.missingCount} missing`
        )
      );
    }
  }

  const attendance = profile.attendance;
  if (attendance.source !== "none") {
    lines.push(
      "",
      "ATTENDANCE",
      `Source: ${attendance.source === "report_snapshot" ? "Official report snapshot" : "Live homeroom attendance"}`,
      `School days: ${formatNullable(attendance.totalSchoolDays)}`,
      `Present: ${formatNullable(attendance.daysPresent)}`,
      `Absent: ${formatNullable(attendance.daysAbsent)}`,
      `Late: ${formatNullable(attendance.daysLate)}`,
      `Excused: ${formatNullable(attendance.daysExcused)}`,
      `Attendance rate: ${formatScore(attendance.attendancePercentage)}`
    );
  } else {
    lines.push("", "ATTENDANCE", attendance.note ?? "No attendance recorded for this period.");
  }

  if (profile.trends.termHistory.length > 0) {
    lines.push("", "TERM TREND");
    for (const point of profile.trends.termHistory) {
      lines.push(
        `- ${point.label}: ${formatScore(point.averageScore)} (${trendSourceLabel(point.source)})`
      );
    }
  }

  const hasComments =
    profile.comments.subjectComments.length > 0 ||
    profile.comments.classTeacherComment ||
    profile.comments.headteacherComment ||
    profile.comments.conduct ||
    profile.comments.interest ||
    profile.comments.attitude;

  if (hasComments) {
    lines.push("", "COMMENTS");
    if (profile.comments.classTeacherComment) {
      lines.push(`Class teacher: ${profile.comments.classTeacherComment}`);
    }
    if (profile.comments.headteacherComment) {
      lines.push(`Headteacher: ${profile.comments.headteacherComment}`);
    }
    for (const entry of [
      ["Conduct", profile.comments.conduct],
      ["Interest", profile.comments.interest],
      ["Attitude", profile.comments.attitude],
    ] as const) {
      if (entry[1]) {
        lines.push(`${entry[0]}: ${entry[1]}`);
      }
    }
    for (const remark of profile.comments.subjectComments) {
      lines.push(`- ${remark.subjectName}: ${remark.comment}`);
    }
    if (profile.permissions.canViewInternalNotes && profile.comments.internalNotes) {
      lines.push(`Internal notes (staff only): ${profile.comments.internalNotes}`);
    }
  }

  if (profile.summary.strongestSubject) {
    lines.push(
      "",
      `Strongest subject: ${profile.summary.strongestSubject.subjectName} (${formatScore(profile.summary.strongestSubject.score)})`
    );
  }
  if (profile.summary.weakestSubject) {
    lines.push(
      `Weakest subject: ${profile.summary.weakestSubject.subjectName} (${formatScore(profile.summary.weakestSubject.score)})`
    );
  }

  return lines.join("\n");
}

export function buildAcademicAIInsightsSystemPrompt(mode: StudentAcademicProfileDTO["aiInsights"]["mode"]) {
  const modeFocus =
    mode === "admin"
      ? "Focus on report readiness blockers, missing evidence, and school-wide academic risk."
      : mode === "teacher"
        ? "Focus on classroom actions, component-level patterns, and subject teacher interventions."
        : mode === "parent"
          ? "Use parent-friendly language. Only reference released or school-approved information."
          : "Use student-friendly, encouraging language.";

  return `You are Leo, an experienced Ghanaian educator analyzing a student academic profile.
${modeFocus}
Use ONLY the facts in the user message. Never invent scores, attendance, comments, diagnoses, or promises.
When data is marked provisional, say so. When data is official/released, treat it as final.
When component breakdowns exist, prefer them over assuming CA/exam splits.
Always respond with valid JSON only, no markdown formatting.`;
}

export function buildAcademicAIInsightsUserPrompt(context: string) {
  return `${context}

Provide your analysis in this exact JSON format (no markdown, no code blocks, just valid JSON):
{
  "riskLevel": "low|medium|high",
  "summary": "1-2 sentence overview grounded only in provided data",
  "strengths": [
    { "subject": "Subject name", "reason": "Why this is a strength", "score": 85 }
  ],
  "weaknesses": [
    { "subject": "Subject name", "reason": "Why this is a weakness", "score": 52, "trend": "improving|declining|stable" }
  ],
  "suggestedActions": {
    "student": ["Actionable advice for the student"],
    "parent": ["Actionable advice for parents"],
    "teacher": ["Actionable advice for teachers"]
  },
  "prioritySubjects": ["Subject names to focus on"],
  "insights": {
    "overallTrend": "Description using term trend data only",
    "examVsCA": "Patterns across score components or assessment types — say 'Not enough data' if components are missing",
    "classComparison": "Comparison using only provided averages/position data"
  }
}

Be specific, actionable, and culturally appropriate for Ghanaian schools.`;
}
