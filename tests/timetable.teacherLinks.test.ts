import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { Teacher } from "@/models/Teacher";
import { resolveTeacherLinksForSlots } from "@/lib/timetable/teacher-links";

function makeLeanQuery<T>(result: T) {
  return {
    sort() {
      return this;
    },
    select() {
      return this;
    },
    populate() {
      return this;
    },
    lean: async () => result,
  };
}

const originalTeacherAssignmentFind = TeacherAssignment.find.bind(TeacherAssignment);
const originalTeacherFind = Teacher.find.bind(Teacher);

afterEach(() => {
  (
    TeacherAssignment as unknown as {
      find: typeof TeacherAssignment.find;
    }
  ).find = originalTeacherAssignmentFind;
  (
    Teacher as unknown as {
      find: typeof Teacher.find;
    }
  ).find = originalTeacherFind;
});

test("resolveTeacherLinksForSlots uses active assignment when slot has no teacher", async () => {
  const schoolId = new Types.ObjectId();
  const academicPeriodId = new Types.ObjectId();
  const classGroupId = new Types.ObjectId();
  const subjectId = new Types.ObjectId();
  const teacherId = new Types.ObjectId();

  (
    TeacherAssignment as unknown as {
      find: typeof TeacherAssignment.find;
    }
  ).find = (() =>
    makeLeanQuery([
      {
        classGroupId,
        subjectId,
        teacherId,
      },
    ])) as unknown as typeof TeacherAssignment.find;

  (
    Teacher as unknown as {
      find: typeof Teacher.find;
    }
  ).find = (() =>
    makeLeanQuery([
      {
        _id: teacherId,
        userId: { firstName: "Carly", lastName: "Magnifico" },
      },
    ])) as unknown as typeof Teacher.find;

  const [resolved] = await resolveTeacherLinksForSlots({
    schoolId,
    academicPeriodId,
    slots: [{ classGroupId, subjectId, teacherId: null }],
  });

  assert.equal(resolved.teacherId, String(teacherId));
  assert.equal(resolved.teacherName, "Carly Magnifico");
  assert.equal(resolved.source, "assignment");
});

test("resolveTeacherLinksForSlots prefers active assignment over stale slot teacher", async () => {
  const schoolId = new Types.ObjectId();
  const academicPeriodId = new Types.ObjectId();
  const classGroupId = new Types.ObjectId();
  const subjectId = new Types.ObjectId();
  const staleTeacherId = new Types.ObjectId();
  const activeTeacherId = new Types.ObjectId();

  (
    TeacherAssignment as unknown as {
      find: typeof TeacherAssignment.find;
    }
  ).find = (() =>
    makeLeanQuery([
      {
        classGroupId,
        subjectId,
        teacherId: activeTeacherId,
      },
    ])) as unknown as typeof TeacherAssignment.find;

  (
    Teacher as unknown as {
      find: typeof Teacher.find;
    }
  ).find = (() =>
    makeLeanQuery([
      {
        _id: staleTeacherId,
        userId: { firstName: "Old", lastName: "Teacher" },
      },
      {
        _id: activeTeacherId,
        userId: { firstName: "Carly", lastName: "Magnifico" },
      },
    ])) as unknown as typeof Teacher.find;

  const [resolved] = await resolveTeacherLinksForSlots({
    schoolId,
    academicPeriodId,
    slots: [{ classGroupId, subjectId, teacherId: staleTeacherId }],
  });

  assert.equal(resolved.teacherId, String(activeTeacherId));
  assert.equal(resolved.teacherName, "Carly Magnifico");
  assert.deepEqual(resolved.teacherIds, [String(activeTeacherId)]);
  assert.equal(resolved.source, "assignment");
});
