import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import {
  dedupeTeacherImportClassMatches,
  resolveTeacherImportSubjectToken,
} from "@/lib/teachers/analyze-teacher-import";

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
