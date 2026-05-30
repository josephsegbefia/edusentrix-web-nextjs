import { Types } from "mongoose";
import { recordActivity } from "@/lib/audit/recordActivity";

export async function recordExamTimetablePublished(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  examSessionId: Types.ObjectId;
  versionId: Types.ObjectId;
  versionNumber: number;
  changeSummary: string;
  entryCount: number;
}) {
  await recordActivity({
    schoolId: input.schoolId,
    userId: input.actorId,
    type: "exam.timetable.published",
    entityType: "ExamTimetableVersion",
    entityId: input.versionId,
    description: "Exam timetable published.",
    metadata: {
      examSessionId: String(input.examSessionId),
      versionNumber: input.versionNumber,
      changeSummary: input.changeSummary,
      entryCount: input.entryCount,
    },
  });
}
