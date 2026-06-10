import "server-only";

import type { Types } from "mongoose";
import { loadWardAccessibleSession } from "@/lib/lessons/ward-lesson-session-access";

/** Whether a student in `studentClassGroupId` can open this session at all. */
export async function loadStudentAccessibleSession(input: {
  sessionId: Types.ObjectId;
  schoolId: Types.ObjectId;
  studentClassGroupId: Types.ObjectId;
  select?: string;
}) {
  return loadWardAccessibleSession({
    sessionId: input.sessionId,
    schoolId: input.schoolId,
    classGroupId: input.studentClassGroupId,
    audience: "student",
    select: input.select,
  });
}

export { canStudentViewNotebookNotes } from "@/lib/lessons/notebook-notes-visibility";
