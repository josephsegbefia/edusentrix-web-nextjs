import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import {
  isTeacherStudioEnvEnabled,
  requireTeacherStudioAccess,
} from "../src/lib/features/teacherStudio";
import { SchoolSettings } from "../src/models/SchoolSettings";
import { PERMISSIONS } from "../src/lib/rbac";
import type { TeacherContext } from "../src/lib/auth/requireTeacher";

const baseContext: TeacherContext = {
  userId: new Types.ObjectId(),
  teacherId: new Types.ObjectId(),
  schoolId: new Types.ObjectId(),
  roles: ["teacher"],
  subroles: [],
  permissions: [PERMISSIONS.assignmentsView],
  homeroomClassGroupId: null,
  isAdmin: false,
};

test("isTeacherStudioEnvEnabled defaults to true when unset", () => {
  const previous = process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO;
  delete process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO;
  assert.equal(isTeacherStudioEnvEnabled(), true);
  if (previous !== undefined) {
    process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO = previous;
  }
});

test("requireTeacherStudioAccess blocks when env disabled", async () => {
  const previous = process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO;
  process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO = "false";
  try {
    await assert.rejects(async () => {
      await requireTeacherStudioAccess(baseContext, PERMISSIONS.assignmentsView);
    });
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO;
    } else {
      process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO = previous;
    }
  }
});

test("requireTeacherStudioAccess blocks when permission missing", async () => {
  const previous = process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO;
  process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO = "true";

  const originalFindOne = SchoolSettings.findOne.bind(SchoolSettings);
  const mockedFindOne = (() => ({
    select: () => ({
      lean: async () => ({ teacherStudio: { enabled: true } }),
    }),
  })) as unknown as typeof SchoolSettings.findOne;
  SchoolSettings.findOne = mockedFindOne;

  const context: TeacherContext = {
    ...baseContext,
    permissions: [],
  };

  try {
    await assert.rejects(async () => {
      await requireTeacherStudioAccess(context, PERMISSIONS.assignmentsView);
    });
  } finally {
    SchoolSettings.findOne = originalFindOne;
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO;
    } else {
      process.env.NEXT_PUBLIC_FEATURE_TEACHER_STUDIO = previous;
    }
  }
});
