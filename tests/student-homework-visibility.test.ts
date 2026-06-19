import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Types } from "mongoose";

import { buildStudentVisibleHomeworkFilter } from "../src/lib/learn/student-homework-visibility";

describe("buildStudentVisibleHomeworkFilter", () => {
  const schoolId = new Types.ObjectId();
  const studentId = new Types.ObjectId();
  const classGroupId = new Types.ObjectId();
  const academicPeriodId = new Types.ObjectId();

  it("scopes homework to the student's class and targeting rules", () => {
    const filter = buildStudentVisibleHomeworkFilter({
      schoolId,
      studentId,
      classGroupId,
    });

    assert.deepEqual(filter.classGroupIds, { $in: [classGroupId] });
    assert.deepEqual(filter.status, { $in: ["published", "closed"] });
    assert.equal(filter.academicPeriodId, undefined);
    assert.ok(Array.isArray(filter.$or));
    assert.equal(filter.$or?.length, 4);
  });

  it("adds the current academic period when provided", () => {
    const filter = buildStudentVisibleHomeworkFilter({
      schoolId,
      studentId,
      classGroupId,
      academicPeriodId,
    });

    assert.equal(String(filter.academicPeriodId), String(academicPeriodId));
  });
});
