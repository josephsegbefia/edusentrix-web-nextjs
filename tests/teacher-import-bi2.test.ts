import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import { parseTeacherImportWorkbook, teacherImportMappingForHeader, type TeacherImportCanonicalField } from "@/lib/teachers/parse-teacher-import";
import { analyzeTeacherImport } from "@/lib/teachers/analyze-teacher-import";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { User } from "@/models/User";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";

const schoolId = new Types.ObjectId();
const p2 = new Types.ObjectId();
const p4 = new Types.ObjectId();
const jhs3 = new Types.ObjectId();
const p2a = new Types.ObjectId();
const p4a = new Types.ObjectId();
const p4b = new Types.ObjectId();
const jhs3a = new Types.ObjectId();
const mathsLower = new Types.ObjectId();
const mathsUpper = new Types.ObjectId();
const mathsJhs = new Types.ObjectId();
const scienceUpper = new Types.ObjectId();
const frenchPrimary = new Types.ObjectId();
const frenchJhs = new Types.ObjectId();

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

const grades = [
  { _id: p2, name: "Primary 2", code: "P2", stage: "Primary", order: 2 },
  { _id: p4, name: "Primary 4", code: "P4", stage: "Primary", order: 4 },
  { _id: jhs3, name: "JHS 3", code: "JHS3", stage: "JHS", order: 9 },
];

const classes = [
  { _id: p2a, name: "A", gradeId: p2, subjectOfferingIds: [mathsLower] },
  { _id: p4a, name: "A", gradeId: p4, subjectOfferingIds: [mathsUpper, scienceUpper] },
  { _id: p4b, name: "B", gradeId: p4, subjectOfferingIds: [mathsUpper, scienceUpper] },
  { _id: jhs3a, name: "A", gradeId: jhs3, subjectOfferingIds: [mathsJhs, frenchJhs] },
];

const offerings = [
  { _id: mathsLower, subjectId: new Types.ObjectId(), subjectFamily: "Mathematics", displayName: "Mathematics - Lower Primary", shortName: "Mathematics", code: "MATH-LP", gradeIds: [p2], gradeBand: "lower_primary", stage: "lower_primary", isActive: true },
  { _id: mathsUpper, subjectId: new Types.ObjectId(), subjectFamily: "Mathematics", displayName: "Mathematics - Upper Primary", shortName: "Mathematics", code: "MATH-UP", gradeIds: [p4], gradeBand: "upper_primary", stage: "upper_primary", isActive: true },
  { _id: mathsJhs, subjectId: new Types.ObjectId(), subjectFamily: "Mathematics", displayName: "Mathematics - JHS", shortName: "Mathematics", code: "MATH-JHS", gradeIds: [jhs3], gradeBand: "jhs", stage: "jhs", isActive: true },
  { _id: scienceUpper, subjectId: new Types.ObjectId(), subjectFamily: "Science", displayName: "Science - Upper Primary", shortName: "Science", code: "SCI-UP", gradeIds: [p4], gradeBand: "upper_primary", stage: "upper_primary", isActive: true },
  { _id: frenchPrimary, subjectId: new Types.ObjectId(), subjectFamily: "French", displayName: "French - Upper Primary", shortName: "French", code: "FR-UP", gradeIds: [p4], gradeBand: "upper_primary", stage: "upper_primary", isActive: true },
  { _id: frenchJhs, subjectId: new Types.ObjectId(), subjectFamily: "French Language", displayName: "French Language - JHS", shortName: "French Language", code: "FR-JHS", gradeIds: [jhs3], gradeBand: "jhs", stage: "jhs", isActive: true },
];

function query<T>(value: T) {
  return { select: () => query(value), lean: async () => value };
}

async function withCatalog<T>(callback: (assignmentFind?: typeof TeacherAssignment.find) => Promise<T>, assignmentRows: unknown[] = []) {
  const originals = {
    offerings: SubjectOffering.find,
    grades: Grade.find,
    classes: ClassGroup.find,
    users: User.find,
    teachers: Teacher.find,
    assignments: TeacherAssignment.find,
  };
  try {
    (SubjectOffering.find as unknown as () => unknown) = () => query(offerings);
    (Grade.find as unknown as () => unknown) = () => query(grades);
    (ClassGroup.find as unknown as () => unknown) = () => query(classes);
    (User.find as unknown as () => unknown) = () => query([]);
    (Teacher.find as unknown as () => unknown) = () => query([]);
    (TeacherAssignment.find as unknown as () => unknown) = () => query(assignmentRows);
    return await callback(originals.assignments);
  } finally {
    (SubjectOffering.find as unknown as typeof SubjectOffering.find) = originals.offerings;
    (Grade.find as unknown as typeof Grade.find) = originals.grades;
    (ClassGroup.find as unknown as typeof ClassGroup.find) = originals.classes;
    (User.find as unknown as typeof User.find) = originals.users;
    (Teacher.find as unknown as typeof Teacher.find) = originals.teachers;
    (TeacherAssignment.find as unknown as typeof TeacherAssignment.find) = originals.assignments;
  }
}

test("BI.2 parser interprets alternate headers, repeated subject columns, names, grades, and classes", () => {
  const result = parseTeacherImportWorkbook(Buffer.from([
    "Staff Name,Staff Mail,Mobile,Subject 1,Subject 2,Forms Taught,Classes Taught,Form Class,Math Class,Science Class",
    "Kofi Daniel Kwame Mensah,kofi@example.com,0241234567,Maths,Science,Primary 4,P4A; P4B,Primary 4 A,P4A,P4B",
  ].join("\n")), "teachers.csv");
  const row = result.rows[0];
  assert.equal(row?.rowRef, "T002");
  assert.deepEqual(row?.middleNames, ["Daniel", "Kwame"]);
  assert.deepEqual(row?.subjects, ["Maths", "Science"]);
  assert.deepEqual(row?.gradeScopes, ["Primary 4"]);
  assert.deepEqual(row?.classScopes, ["P4A", "P4B"]);
  assert.equal(row?.homeroomClass, "Primary 4 A");
  assert.equal(row?.phone, "0241234567");
  assert.equal(result.columnMappings.filter((item) => item.canonicalField === "subjects").length, 2);
  assert.deepEqual(row?.explicitAssignments.map((item) => ({ subject: item.subjectValue, classValue: item.classValue })), [
    { subject: "Math", classValue: "P4A" },
    { subject: "Science", classValue: "P4B" },
  ]);
});

test("BI.2 AI-first mapping sends every source header to Leo and keeps proposals pending confirmation", async () => {
  let receivedHeaders: string[] = [];
  await withCatalog(async () => {
    const analysis = await analyzeTeacherImport({
      schoolId,
      fileName: "teachers.csv",
      fileBytes: Buffer.from([
        "Staff member,Work mailbox,Campus room",
        "Ama Mensah,ama@example.com,Primary 4 A",
      ].join("\n")),
      leo: {
        suggestHeaders: async ({ unresolvedHeaders }) => {
          receivedHeaders = unresolvedHeaders;
          return {
            ok: true as const,
            suggestions: [
              { sourceHeader: "Staff member", canonicalField: "fullName", confidence: 0.98, rationale: "The header identifies the teacher's full name." },
              { sourceHeader: "Work mailbox", canonicalField: "email", confidence: 0.99, rationale: "The header identifies a work email address." },
              { sourceHeader: "Campus room", canonicalField: "homeroomClass", confidence: 0.72, rationale: "The header may describe a teacher's homeroom." },
            ],
            metadata: { status: "completed" as const, provider: "fixture", model: "fixture" },
          };
        },
      },
    });
    assert.deepEqual(receivedHeaders, ["Staff member", "Work mailbox", "Campus room"]);
    assert.equal(analysis.columnMappings.every((mapping) => mapping.source === "leo"), true);
    assert.equal(analysis.columnMappings.every((mapping) => mapping.status === "needs_review"), true);
    assert.equal(analysis.parsedRows[0]?.firstName, "Ama");
    assert.equal(analysis.parsedRows[0]?.lastName, "Mensah");
    assert.equal(analysis.parsedRows[0]?.email, "ama@example.com");
    assert.equal(analysis.parsedRows[0]?.homeroomClass, "Primary 4 A");
  });
});

test("BI.2 resolves P2 Maths to lower and P4 Mathematics - Primary to upper by class context", async () => {
  await withCatalog(async () => {
    const analysis = await analyzeTeacherImport({
      schoolId,
      fileName: "teachers.csv",
      fileBytes: Buffer.from([
        "Teacher Name,Staff Mail,Classes Taught,Courses Handled,Form Class",
        "Abena Mary Asante,abena@example.com,P2A,Maths,Primary 2 A",
        "Emefa Amedzro,emefa@example.com,P4A,Mathematics - Primary,Primary 4 A",
        "Cross Band,cross@example.com,P2A; P4A,Maths,",
      ].join("\n")),
      leo: leoHeaderFixture,
    });
    assert.deepEqual(analysis.parsedRows[0]?.subjectOfferingIds, [String(mathsLower)]);
    assert.deepEqual(analysis.parsedRows[1]?.subjectOfferingIds, [String(mathsUpper)]);
    assert.deepEqual(new Set(analysis.parsedRows[2]?.subjectOfferingIds), new Set([String(mathsLower), String(mathsUpper)]));
    assert.equal(analysis.parsedRows[1]?.issues.some((item) => item.code === "stage_mismatch"), false);
    assert.equal(analysis.parsedRows[1]?.resolutionStatus, "resolved");
    assert.equal(analysis.analysisSummary?.blockedRows, 0);
  });
});

test("BI.2 flags JHS/Primary subject mismatch and preserves valid JHS subject", async () => {
  await withCatalog(async () => {
    const analysis = await analyzeTeacherImport({
      schoolId,
      fileName: "teachers.csv",
      fileBytes: Buffer.from([
        "Teacher Name,Staff Mail,Classes Taught,Subjects",
        "Mariam Sulemana,mariam@example.com,JHS3A,French - Primary; French Language - JHS",
      ].join("\n")),
      leo: leoHeaderFixture,
    });
    const row = analysis.parsedRows[0];
    assert.equal(row?.subjectOfferingIds.includes(String(frenchJhs)), true);
    assert.equal(row?.subjectOfferingIds.includes(String(frenchPrimary)), false);
    assert.equal(row?.issues.some((item) => item.code === "stage_mismatch"), true);
    assert.equal(row?.resolutionStatus, "needs_review");
  });
});

test("BI.2 normalizes explicit assignments without creating TeacherAssignment records", async () => {
  await withCatalog(async () => {
    const analysis = await analyzeTeacherImport({
      schoolId,
      fileName: "teachers.csv",
      fileBytes: Buffer.from([
        "Teacher Name,Staff Mail,Teaching Assignments",
        "Yaw Boakye,yaw@example.com,P4A - Maths; P4B - Science",
      ].join("\n")),
      leo: leoHeaderFixture,
    });
    const assignments = analysis.parsedRows[0]?.explicitAssignments || [];
    assert.equal(assignments.length, 2);
    assert.equal(assignments.every((item) => item.classGroupId && item.subjectOfferingId), true);
    assert.equal(assignments[0]?.status, "needs_review");
    assert.equal(assignments[1]?.status, "resolved");
    assert.equal(analysis.parsedRows[0]?.issues.some((item) => item.code === "assignment_overlap"), true);
    assert.equal(analysis.parsedRows[0]?.subjectOfferingIds.length, 0);
  }, [{ teacherId: new Types.ObjectId(), classGroupId: p4a, subjectOfferingId: mathsUpper }]);
});

test("BI.2 groups duplicate imported homerooms instead of replacing either teacher", async () => {
  await withCatalog(async () => {
    const analysis = await analyzeTeacherImport({
      schoolId,
      fileName: "teachers.csv",
      fileBytes: Buffer.from([
        "Teacher Name,Staff Mail,Form Class,Subjects",
        "Ama Mensah,ama@example.com,Primary 4 A,Maths",
        "Kojo Mensah,kojo@example.com,Primary 4 A,Science",
      ].join("\n")),
      leo: leoHeaderFixture,
    });
    const grouped = analysis.analysisIssues?.find((item) => item.issueType === "duplicate_homeroom" && item.scope === "group");
    assert.deepEqual(grouped?.rowRefs, ["T002", "T003"]);
    assert.equal(grouped?.resolutionClass, "REVIEW");
    assert.equal(analysis.parsedRows.every((row) => row.homeroomClassGroupId === String(p4a)), true);
  });
});

test("BI.2 surfaces duplicate source identity signals without silently merging teachers", async () => {
  await withCatalog(async () => {
    const analysis = await analyzeTeacherImport({
      schoolId,
      fileName: "teachers.csv",
      fileBytes: Buffer.from([
        "Teacher Name,Staff Mail,Phone,Subjects",
        "Akosua Mensah,akosua.one@example.com,0241234567,Maths",
        "Akosua Mensah,akosua.two@example.com,0241234567,Science",
      ].join("\n")),
      leo: leoHeaderFixture,
    });
    assert.equal(analysis.parsedRows.every((row) => row.issues.some((item) => item.code === "duplicate" && item.field === "phone")), true);
    assert.equal(analysis.parsedRows.every((row) => row.issues.some((item) => item.code === "duplicate_source_teacher")), true);
    assert.equal(analysis.parsedRows.every((row) => row.rowState === "pending"), true);
  });
});
