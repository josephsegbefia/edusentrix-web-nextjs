import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { Types } from "mongoose";
import { analyzeTeacherImport } from "@/lib/teachers/analyze-teacher-import";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { User } from "@/models/User";
import { teacherImportMappingForHeader, type TeacherImportCanonicalField } from "@/lib/teachers/parse-teacher-import";

const fixturePath = join(process.cwd(), "tests/fixtures/teacher-import/real-teachers-18.csv");
const fixtureBytes = () => readFileSync(fixturePath);
const schoolId = new Types.ObjectId();

const leoHeaderFixture = {
  suggestHeaders: async ({ unresolvedHeaders }: { unresolvedHeaders: string[] }) => ({
    ok: true as const,
    suggestions: unresolvedHeaders.map((sourceHeader) => {
      const mapping = teacherImportMappingForHeader(sourceHeader);
      return { sourceHeader, canonicalField: mapping.canonicalField as TeacherImportCanonicalField | null, confidence: 1, rationale: "Fixture Leo mapping" };
    }),
    metadata: { status: "completed" as const, provider: "fixture", model: "fixture" },
  }),
};

type FixtureGrade = {
  _id: Types.ObjectId;
  name: string;
  code: string;
  stage: string;
  order: number;
};

type FixtureOffering = {
  _id: Types.ObjectId;
  subjectId: Types.ObjectId;
  subjectFamily: string;
  displayName: string;
  shortName: string;
  code: string;
  gradeIds: Types.ObjectId[];
  gradeBand: string;
  stage: string;
  isActive: true;
};

function makeFixtureCatalog() {
  const grades: FixtureGrade[] = [
    ...Array.from({ length: 6 }, (_, index) => ({
      _id: new Types.ObjectId(),
      name: `Primary ${index + 1}`,
      code: `P${index + 1}`,
      stage: "Primary",
      order: index + 1,
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
      _id: new Types.ObjectId(),
      name: `JHS ${index + 1}`,
      code: `JHS${index + 1}`,
      stage: "JHS",
      order: index + 7,
    })),
  ];
  const byBand = {
    lower_primary: grades.slice(0, 3),
    upper_primary: grades.slice(3, 6),
    jhs: grades.slice(6),
  };
  const offerings: FixtureOffering[] = [];
  const add = (subjectFamily: string, label: string, code: string, band: keyof typeof byBand) => {
    offerings.push({
      _id: new Types.ObjectId(),
      subjectId: new Types.ObjectId(),
      subjectFamily,
      displayName: `${label} - ${band === "lower_primary" ? "Lower Primary" : band === "upper_primary" ? "Upper Primary" : "JHS"}`,
      shortName: label,
      code,
      gradeIds: byBand[band].map((grade) => grade._id),
      gradeBand: band,
      stage: band,
      isActive: true,
    });
  };

  for (const subject of ["Creative Arts", "English Language", "Ghanaian Language", "Mathematics", "Religious and Moral Education", "Science"]) {
    add(subject, subject, `${subject.slice(0, 3).toUpperCase()}-LP`, "lower_primary");
    add(subject, subject, `${subject.slice(0, 3).toUpperCase()}-UP`, "upper_primary");
  }
  add("Our World and Our People", "Our World and Our People", "OWOP-LP", "lower_primary");
  add("Our World and Our People", "Our World and Our People", "OWOP-UP", "upper_primary");
  add("French", "French", "FRE-UP", "upper_primary");
  add("Physical Education", "Physical Education", "PE-UP", "upper_primary");
  add("Computing", "Computing", "COMP-UP", "upper_primary");
  for (const subject of [
    "English Language",
    "Ghanaian Language",
    "Religious and Moral Education",
    "Mathematics",
    "Career Technology",
    "Science",
    "Creative Arts and Design",
    "Social Studies",
    "French Language",
    "Computing",
    "Physical Education and Health",
  ]) {
    add(subject, subject, `${subject.slice(0, 3).toUpperCase()}-JHS`, "jhs");
  }

  const classes = grades.flatMap((grade) => ["A", "B"].map((name) => ({
    _id: new Types.ObjectId(),
    name,
    gradeId: grade._id,
    subjectOfferingIds: offerings.filter((offering) => offering.gradeIds.includes(grade._id)).map((offering) => offering._id),
  })));
  return { grades, offerings, classes };
}

function query<T>(value: T) {
  return { select: () => query(value), lean: async () => value };
}

async function withFixtureCatalog<T>(callback: (catalog: ReturnType<typeof makeFixtureCatalog>) => Promise<T>) {
  const catalog = makeFixtureCatalog();
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

const leoFailure = {
  ...leoHeaderFixture,
  suggestSemantics: async () => ({
    ok: false as const,
    unavailable: true as const,
    reason: "fixture provider failure",
    metadata: {
      status: "degraded" as const,
      reasonCode: "provider_error" as const,
      retryable: true,
      lastErrorCode: "IMPORT_AI_PROVIDER_ERROR" as const,
      provider: "fixture",
      model: "fixture",
    },
  }),
};

test("BI.2V runs the real 18-teacher fixture through parse and catalog analysis", async () => {
  await withFixtureCatalog(async (catalog) => {
    const analysis = await analyzeTeacherImport({
      schoolId,
      fileName: "real-teachers-18.csv",
      fileBytes: fixtureBytes(),
      leo: leoFailure,
    });
    const rows = analysis.parsedRows;
    const byEmail = new Map(rows.map((row) => [row.email, row]));
    const lowerMath = catalog.offerings.find((offering) => offering.displayName === "Mathematics - Lower Primary");
    const upperMath = catalog.offerings.find((offering) => offering.displayName === "Mathematics - Upper Primary");
    const jhsMath = catalog.offerings.find((offering) => offering.displayName === "Mathematics - JHS");

    assert.equal(rows.length, 18);
    assert.equal(analysis.analysisSummary?.totalRows, 18);
    assert.equal(analysis.analysisSummary?.leoUnavailable, true);
    assert.equal(analysis.leoAnalysis?.status, "degraded");
    assert.equal(analysis.leoAnalysis?.retryable, true);
    assert.equal(analysis.leoAnalysis?.reasonCode, "provider_error");
    assert.equal(analysis.analysisSummary?.readyRows && analysis.analysisSummary.readyRows > 0, true);
    assert.equal(analysis.analysisSummary?.needsReviewRows, 14);
    assert.equal(analysis.analysisSummary?.blockedRows, 0);
    assert.deepEqual(
      {
        readyRows: analysis.analysisSummary?.readyRows,
        needsReviewRows: analysis.analysisSummary?.needsReviewRows,
        blockedRows: analysis.analysisSummary?.blockedRows,
        autoResolutionCount: analysis.analysisSummary?.autoResolutionCount,
        reviewCount: analysis.analysisSummary?.reviewCount,
        blockedCount: analysis.analysisSummary?.blockedCount,
        conflictCount: analysis.analysisSummary?.conflictCount,
        reviewIssues: analysis.analysisSummary?.reviewIssues,
        groupedReviewIssues: analysis.analysisSummary?.groupedReviewIssues,
        blockingIssues: analysis.analysisSummary?.blockingIssues,
      },
      { readyRows: 4, needsReviewRows: 14, blockedRows: 0, autoResolutionCount: 64, reviewCount: 14, blockedCount: 0, conflictCount: 0, reviewIssues: 4, groupedReviewIssues: 2, blockingIssues: 0 },
    );
    assert.equal(rows.every((row) => row.explicitAssignments.length === 0), true);
    assert.equal(new Set(rows.map((row) => row.homeroomClassGroupId)).size, 18);
    assert.equal(rows.every((row) => row.homeroomClassGroupId), true);
    assert.equal(analysis.classResolutions.length, 18);
    assert.equal(analysis.classResolutions.every((resolution) => {
      const ids = (resolution.candidateOptions || []).map((candidate) => candidate.id);
      return new Set(ids).size === ids.length;
    }), true);
    assert.equal(analysis.analysisIssues?.some((issue) => issue.issueType === "ambiguous" && issue.fieldKey === "homeroomClass"), false);

    assert.deepEqual(byEmail.get("abena.asante@example.com")?.subjectOfferingIds.includes(String(lowerMath?._id)), true);
    assert.equal(byEmail.get("abena.asante@example.com")?.issues.some((issue) => issue.code === "ambiguous" && issue.value === "Mathematics - Primary"), false);
    assert.equal(byEmail.get("emefa.amedzro@example.com")?.subjectOfferingIds.includes(String(upperMath?._id)), true);
    assert.equal(byEmail.get("emefa.amedzro@example.com")?.issues.some((issue) => issue.code === "ambiguous" && issue.value === "Mathematics - Primary"), false);
    assert.equal(byEmail.get("isaac.addo@example.com")?.subjectOfferingIds.includes(String(jhsMath?._id)), true);

    const historyRows = rows.filter((row) => row.subjects.includes("History - Primary"));
    assert.equal(historyRows.length, 12);
    assert.equal(historyRows.every((row) => row.resolutionStatus === "needs_review"), true);
    assert.equal(historyRows.every((row) => row.issues.some((issue) => issue.code === "subject_review" && issue.value === "History - Primary" && issue.groupedIssueId)), true);
    assert.equal(historyRows.every((row) => !row.subjectOfferingIds.some((id) => id === String(catalog.offerings.find((offering) => offering.subjectFamily === "Our World and Our People")?._id))), true);

    const mariam = byEmail.get("mariam.sulemana@example.com");
    assert.equal(mariam?.subjectOfferingIds.some((id) => id === String(catalog.offerings.find((offering) => offering.displayName === "French Language - JHS")?._id)), true);
    assert.equal(mariam?.issues.some((issue) => issue.code === "stage_mismatch" && issue.value === "French - Primary"), true);
    assert.equal(mariam?.subjects.includes("French - Primary"), true);

    const yaw = byEmail.get("yaw.boakye@example.com");
    assert.equal(yaw?.subjectOfferingIds.some((id) => id === String(catalog.offerings.find((offering) => offering.displayName === "Computing - JHS")?._id)), true);
    assert.equal(yaw?.subjectOfferingIds.some((id) => id === String(catalog.offerings.find((offering) => offering.displayName === "Physical Education and Health - JHS")?._id)), true);
    assert.equal(yaw?.issues.some((issue) => issue.code === "stage_mismatch" && issue.value === "Computing - Primary"), true);
    assert.equal(yaw?.subjects.includes("Computing - Primary"), true);

    console.log("BI.2V_FIXTURE_RESULT", JSON.stringify({
      summary: analysis.analysisSummary,
      representatives: ["abena.asante@example.com", "emefa.amedzro@example.com", "mariam.sulemana@example.com", "yaw.boakye@example.com"].map((email) => {
        const row = byEmail.get(email);
        return {
          teacher: `${row?.firstName} ${row?.lastName}`,
          homeroom: row?.homeroomClass,
          sourceSubject: row?.subjects[0],
          resolvedOfferings: row?.subjectOfferingIds.map((id) => catalog.offerings.find((offering) => String(offering._id) === id)?.displayName || id),
          issueCodes: row?.issues.map((issue) => issue.code),
          resolutionStatus: row?.resolutionStatus,
        };
      }),
      counts: {
        totalRows: rows.length,
        readyRows: rows.filter((row) => row.rowState === "ready").length,
        reviewRows: rows.filter((row) => row.resolutionStatus === "needs_review").length,
        blockedRows: rows.filter((row) => row.resolutionStatus === "blocked").length,
        autoSubjectResolutions: analysis.subjectResolutions.filter((resolution) => resolution.status === "resolved").length,
        reviewSubjectIssues: analysis.subjectResolutions.filter((resolution) => resolution.status === "needs_review").length,
        groupedReviewIssues: analysis.analysisIssues?.filter((issue) => issue.scope === "group" && issue.status === "open").length,
        stageMismatchIssues: rows.reduce((count, row) => count + row.issues.filter((issue) => issue.code === "stage_mismatch").length, 0),
        analysisErrors: analysis.analysisErrors.length,
        unexpectedFailures: 0,
      },
    }));
  });
});

test("BI.2V keeps a Leo semantic History suggestion at REVIEW", async () => {
  await withFixtureCatalog(async (catalog) => {
    const analysis = await analyzeTeacherImport({
      schoolId,
      fileName: "real-teachers-18.csv",
      fileBytes: fixtureBytes(),
      leo: {
        ...leoHeaderFixture,
        suggestSemantics: async () => ({
          ok: true as const,
          suggestions: {
            subjectSuggestions: [],
            classSuggestions: [],
            stageMismatchSuggestions: [],
            semanticSubstitutionSuggestions: [{
              sourceValue: "History - Primary",
              candidateSubjectFamily: "Our World and Our People",
              rationale: "The school catalog uses Our World and Our People for this curriculum area.",
            }],
          },
          metadata: { status: "completed" as const, provider: "fixture", model: "fixture", recommendationCount: 1 },
        }),
      },
    });
    const historyResolutions = analysis.subjectResolutions.filter((resolution) => resolution.sourceValue === "History - Primary");
    const historyRows = analysis.parsedRows.filter((row) => row.subjects.includes("History - Primary"));
    const owopIds = new Set(catalog.offerings.filter((offering) => offering.subjectFamily === "Our World and Our People").map((offering) => String(offering._id)));

    assert.equal(historyResolutions.length > 0, true);
    assert.equal(historyResolutions.every((resolution) => resolution.status === "needs_review" && resolution.resolutionClass === "REVIEW" && resolution.requiresHumanConfirmation === true), true);
    assert.equal(historyResolutions.every((resolution) => resolution.candidateOptions?.some((candidate) => owopIds.has(candidate.id))), true);
    assert.equal(historyRows.every((row) => row.resolutionStatus === "needs_review"), true);
    assert.equal(historyRows.every((row) => row.issues.some((issue) => issue.code === "semantic_substitution_review")), true);
    assert.equal(historyRows.every((row) => !row.subjectOfferingIds.some((id) => owopIds.has(id))), true);
    assert.equal(analysis.analysisSummary?.blockedRows, 0);
  });
});
