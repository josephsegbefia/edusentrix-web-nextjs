import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import {
  analyzeTeacherImport,
  dedupeTeacherImportClassMatches,
  resolveTeacherImportSubjectToken,
  teacherImportResolutionKey,
} from "@/lib/teachers/analyze-teacher-import";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { User } from "@/models/User";
import { Teacher } from "@/models/Teacher";

const lowerGrade = new Types.ObjectId();
const upperGrade = new Types.ObjectId();
const lowerOffering = {
  _id: new Types.ObjectId(),
  subjectId: new Types.ObjectId(),
  subjectFamily: "Creative Arts",
  displayName: "Creative Arts - Lower Primary",
  shortName: "Creative Arts",
  code: "CA-LP",
  gradeIds: [lowerGrade],
  gradeBand: "lower_primary",
  stage: "lower_primary",
};
const upperOffering = {
  ...lowerOffering,
  _id: new Types.ObjectId(),
  subjectId: new Types.ObjectId(),
  displayName: "Creative Arts - Upper Primary",
  code: "CA-UP",
  gradeIds: [upperGrade],
  gradeBand: "upper_primary",
  stage: "upper_primary",
};

test("subject aliases use homeroom grade context to choose the real offering", () => {
  const lower = resolveTeacherImportSubjectToken(
    "Creative Arts - Primary",
    {} as never,
    { _id: new Types.ObjectId(), name: "A", gradeId: lowerGrade },
    [lowerOffering, upperOffering]
  );
  const upper = resolveTeacherImportSubjectToken(
    "Creative Arts - Primary",
    {} as never,
    { _id: new Types.ObjectId(), name: "A", gradeId: upperGrade },
    [lowerOffering, upperOffering]
  );
  assert.equal(lower.status, "resolved");
  assert.equal(lower.candidates[0]?.displayName, "Creative Arts - Lower Primary");
  assert.equal(upper.candidates[0]?.displayName, "Creative Arts - Upper Primary");
});

test("class aliases are deduplicated by ClassGroup id", () => {
  const id = new Types.ObjectId();
  const matches = dedupeTeacherImportClassMatches([
    { _id: id, name: "JHS 1 A" },
    { _id: id, name: "JHS 1 A" },
    { _id: new Types.ObjectId(), name: "JHS 1 A" },
  ]);
  assert.equal(matches.length, 2);
});

test("the same source subject text keeps separate resolution identities per grade", () => {
  assert.notEqual(
    teacherImportResolutionKey("Creative Arts - Primary", String(lowerGrade)),
    teacherImportResolutionKey("Creative Arts - Primary", String(upperGrade))
  );
});

test("class-level subject offerings narrow the candidate set", () => {
  const result = resolveTeacherImportSubjectToken(
    "Creative Arts - Primary",
    {} as never,
    {
      _id: new Types.ObjectId(),
      name: "Primary 1 A",
      gradeId: lowerGrade,
      subjectOfferingIds: [lowerOffering._id],
    },
    [lowerOffering, upperOffering]
  );
  assert.equal(result.status, "resolved");
  assert.equal(String(result.candidates[0]?._id), String(lowerOffering._id));
});

test("staged analysis resolves Creative Arts - Primary from each row's class offering context", async () => {
  const schoolId = new Types.ObjectId();
  const lowerClass = new Types.ObjectId();
  const upperClass = new Types.ObjectId();
  const originals = {
    offerings: SubjectOffering.find,
    grades: Grade.find,
    classes: ClassGroup.find,
    users: User.find,
    teachers: Teacher.find,
  };
  const query = <T,>(value: T) => ({ select: () => query(value), lean: async () => value });
  try {
    (SubjectOffering.find as unknown as () => unknown) = () => query([lowerOffering, upperOffering]);
    (Grade.find as unknown as () => unknown) = () => query([
      { _id: lowerGrade, name: "Primary 1" },
      { _id: upperGrade, name: "Primary 4" },
    ]);
    (ClassGroup.find as unknown as () => unknown) = () => query([
      { _id: lowerClass, name: "A", gradeId: lowerGrade, subjectOfferingIds: [lowerOffering._id] },
      { _id: upperClass, name: "A", gradeId: upperGrade, subjectOfferingIds: [upperOffering._id] },
    ]);
    (User.find as unknown as () => unknown) = () => query([]);
    (Teacher.find as unknown as () => unknown) = () => query([]);

    const analysis = await analyzeTeacherImport({
      schoolId,
      fileName: "teachers.csv",
      fileBytes: Buffer.from([
        "First Name,Last Name,Email,Subjects,Homeroom Grade,Homeroom Class",
        "Ama,Mensah,ama@example.com,Creative Arts - Primary,Primary 1,A",
        "Akosua,Owusu,akosua@example.com,Creative Arts - Primary,Primary 4,A",
      ].join("\n")),
    });

    assert.deepEqual(
      analysis.parsedRows.map((row) => row.subjectOfferingIds),
      [[String(lowerOffering._id)], [String(upperOffering._id)]]
    );
    assert.equal(analysis.parsedRows.every((row) => row.resolutionStatus === "resolved"), true);
    assert.equal(analysis.subjectResolutions.length, 2);
  } finally {
    (SubjectOffering.find as unknown as typeof SubjectOffering.find) = originals.offerings;
    (Grade.find as unknown as typeof Grade.find) = originals.grades;
    (ClassGroup.find as unknown as typeof ClassGroup.find) = originals.classes;
    (User.find as unknown as typeof User.find) = originals.users;
    (Teacher.find as unknown as typeof Teacher.find) = originals.teachers;
  }
});
