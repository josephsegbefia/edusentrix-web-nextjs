import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import { analyzeTeacherImport } from "@/lib/teachers/analyze-teacher-import";
import { applyTeacherImportReview } from "@/lib/teachers/teacher-import-review";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import type { ITeacherImportJob } from "@/models/TeacherImportJob";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { teacherImportMappingForHeader, type TeacherImportCanonicalField } from "@/lib/teachers/parse-teacher-import";
import { User } from "@/models/User";

const schoolId = new Types.ObjectId();

function query<T>(value: T) {
  return { select: () => query(value), lean: async () => value };
}

function makeCatalog() {
  const grades = [
    ["Primary 1", "P1", "lower_primary"],
    ["Primary 2", "P2", "lower_primary"],
    ["Primary 4", "P4", "upper_primary"],
    ["Primary 5", "P5", "upper_primary"],
  ].map(([name, code, band], order) => ({ _id: new Types.ObjectId(), name, code, stage: "Primary", order, band }));
  const offerings = ["lower_primary", "upper_primary"].flatMap((band) => ["Creative Arts", "English Language"].map((subjectFamily) => ({
    _id: new Types.ObjectId(),
    subjectId: new Types.ObjectId(),
    subjectFamily,
    displayName: `${subjectFamily} - ${band === "lower_primary" ? "Lower Primary" : "Upper Primary"}`,
    shortName: subjectFamily,
    code: `${subjectFamily.slice(0, 3)}-${band}`,
    gradeIds: grades.filter((grade) => grade.band === band).map((grade) => grade._id),
    gradeBand: band,
    stage: "Primary",
    isActive: true as const,
  })));
  const classes = grades.map((grade) => ({
    _id: new Types.ObjectId(),
    name: "A",
    gradeId: grade._id,
    subjectOfferingIds: offerings.filter((offering) => offering.gradeIds.includes(grade._id)).map((offering) => offering._id),
  }));
  return { grades, offerings, classes };
}

async function withCatalog<T>(callback: (catalog: ReturnType<typeof makeCatalog>) => Promise<T>) {
  const catalog = makeCatalog();
  const originals = {
    offerings: SubjectOffering.find,
    grades: Grade.find,
    classes: ClassGroup.find,
    users: User.find,
    teachers: Teacher.find,
    assignments: TeacherAssignment.find,
  };
  try {
    (SubjectOffering.find as unknown as () => unknown) = () => query(catalog.offerings);
    (Grade.find as unknown as () => unknown) = () => query(catalog.grades);
    (ClassGroup.find as unknown as () => unknown) = () => query(catalog.classes);
    (User.find as unknown as () => unknown) = () => query([]);
    (Teacher.find as unknown as () => unknown) = () => query([]);
    (TeacherAssignment.find as unknown as () => unknown) = () => query([]);
    return await callback(catalog);
  } finally {
    (SubjectOffering.find as unknown as typeof SubjectOffering.find) = originals.offerings;
    (Grade.find as unknown as typeof Grade.find) = originals.grades;
    (ClassGroup.find as unknown as typeof ClassGroup.find) = originals.classes;
    (User.find as unknown as typeof User.find) = originals.users;
    (Teacher.find as unknown as typeof Teacher.find) = originals.teachers;
    (TeacherAssignment.find as unknown as typeof TeacherAssignment.find) = originals.assignments;
  }
}

const noLeo = {
  suggestHeaders: async ({ unresolvedHeaders }: { unresolvedHeaders: string[] }) => ({
    ok: true as const,
    suggestions: unresolvedHeaders.map((sourceHeader) => {
      const mapping = teacherImportMappingForHeader(sourceHeader);
      return { sourceHeader, canonicalField: mapping.canonicalField as TeacherImportCanonicalField | null, confidence: 1, rationale: "Fixture Leo mapping" };
    }),
    metadata: { status: "completed" as const, provider: "fixture", model: "fixture" },
  }),
  suggestSemantics: async () => ({
    ok: false as const,
    unavailable: true as const,
    reason: "test provider unavailable",
    metadata: { status: "degraded" as const, reasonCode: "provider_error" as const, retryable: true },
  }),
};

const teacherCsv = [
  "First Name,Last Name,Email,Homeroom Grade,Homeroom Class,Subjects",
  "Ama,One,ama.one@example.com,Primary 1,A,History - Primary",
  "Kojo,Two,kojo.two@example.com,Primary 2,A,History - Primary",
  "Esi,Three,esi.three@example.com,Primary 4,A,History - Primary",
  "Yaw,Four,yaw.four@example.com,Primary 5,A,History - Primary",
].join("\n");

function jobFromAnalysis(analysis: Awaited<ReturnType<typeof analyzeTeacherImport>>): ITeacherImportJob {
  return {
    _id: new Types.ObjectId(),
    schoolId,
    createdByUserId: new Types.ObjectId(),
    status: "review_ready",
    fileName: "bi2vc.csv",
    mimeType: "text/csv",
    fileBytes: null,
    selectedSheetName: analysis.selectedSheetName,
    availableSheets: analysis.availableSheets,
    sheetSelectionRequired: analysis.sheetSelectionRequired,
    columnMappings: analysis.columnMappings,
    parsedRows: analysis.parsedRows,
    subjectResolutions: analysis.subjectResolutions,
    classResolutions: analysis.classResolutions,
    analysisSummary: analysis.analysisSummary,
    analysisWarnings: analysis.analysisWarnings,
    analysisErrors: analysis.analysisErrors,
    analysisIssues: analysis.analysisIssues,
    invitationMode: "create_only",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

test("BI.2VC groups optional History review by band, applies one decision to all linked rows, and still blocks a missing email", async () => {
  await withCatalog(async (catalog) => {
    const analysis = await analyzeTeacherImport({
      schoolId,
      fileName: "bi2vc.csv",
      fileBytes: Buffer.from(teacherCsv),
      leo: noLeo,
    });
    const groups = (analysis.analysisIssues || []).filter((item) => item.issueType === "subject_unresolved" && item.scope === "group");
    assert.equal(analysis.analysisSummary?.blockedRows, 0);
    assert.equal(groups.length, 2);
    assert.deepEqual(groups.map((item) => item.context?.gradeBand).sort(), ["lower_primary", "upper_primary"]);
    assert.equal(groups.every((item) => item.affectedCount === 2 && item.rowRefs.length === 2), true);
    assert.equal(analysis.parsedRows.every((row) => row.resolutionStatus === "needs_review" && row.issues.some((item) => item.groupedIssueId)), true);

    const lowerGroup = groups.find((item) => item.context?.gradeBand === "lower_primary");
    const lowerOffering = catalog.offerings.find((offering) => offering.displayName === "Creative Arts - Lower Primary");
    assert.ok(lowerGroup);
    assert.ok(lowerOffering);
    const job = jobFromAnalysis(analysis);
    await applyTeacherImportReview(job, {
      groupedSubjectResolutions: [{ issueId: lowerGroup.issueId, subjectOfferingIds: [String(lowerOffering._id)] }],
    });
    const lowerRows = job.parsedRows.filter((row) => lowerGroup.rowRefs.includes(`T${String(row.sourceRowNumber).padStart(3, "0")}`));
    const upperRows = job.parsedRows.filter((row) => !lowerGroup.rowRefs.includes(`T${String(row.sourceRowNumber).padStart(3, "0")}`));
    assert.equal(lowerRows.every((row) => row.resolutionStatus === "resolved" && row.subjectOfferingIds.includes(String(lowerOffering._id))), true);
    assert.equal(lowerRows.every((row) => row.provenance?.some((item) => item.note === `Review group: ${lowerGroup.issueId}`) && row.provenance?.some((item) => item.source === "admin" && item.sourceValue === "History - Primary")), true);
    assert.equal(upperRows.every((row) => row.resolutionStatus === "needs_review"), true);
    assert.equal(job.analysisIssues?.find((item) => item.issueId === lowerGroup.issueId)?.status, "resolved");
    assert.equal(job.analysisIssues?.filter((item) => item.issueType === "subject_unresolved" && item.status === "open").length, 1);

    const missingEmail = await analyzeTeacherImport({
      schoolId,
      fileName: "missing-email.csv",
      fileBytes: Buffer.from("First Name,Last Name,Email\nNo,Email,"),
      leo: noLeo,
    });
    assert.equal(missingEmail.parsedRows[0]?.resolutionStatus, "blocked");
    assert.equal(missingEmail.analysisSummary?.blockedRows, 1);
    assert.equal(missingEmail.analysisIssues?.some((item) => item.issueType === "missing_required" && item.resolutionClass === "BLOCKING"), true);
  });
});
