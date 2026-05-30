import { Types } from "mongoose";
import { recordActivity } from "@/lib/audit/recordActivity";

export async function recordExamAssessmentLinkCreated(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  examSessionId: Types.ObjectId;
  examTimetableEntryId: Types.ObjectId;
  assessmentItemId: Types.ObjectId;
  classGroupId: Types.ObjectId;
}) {
  await recordActivity({
    schoolId: input.schoolId,
    userId: input.actorId,
    type: "exam.assessment.created",
    entityType: "ExamTimetableEntry",
    entityId: input.examTimetableEntryId,
    description: "Linked assessment item created from exam timetable entry.",
    metadata: {
      examSessionId: String(input.examSessionId),
      assessmentItemId: String(input.assessmentItemId),
      classGroupId: String(input.classGroupId),
    },
  });
}

export async function recordExamAssessmentLinked(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  examSessionId: Types.ObjectId;
  examTimetableEntryId: Types.ObjectId;
  assessmentItemId: Types.ObjectId;
  classGroupId: Types.ObjectId;
}) {
  await recordActivity({
    schoolId: input.schoolId,
    userId: input.actorId,
    type: "exam.assessment.linked",
    entityType: "ExamTimetableEntry",
    entityId: input.examTimetableEntryId,
    description: "Existing assessment item linked to exam timetable entry.",
    metadata: {
      examSessionId: String(input.examSessionId),
      assessmentItemId: String(input.assessmentItemId),
      classGroupId: String(input.classGroupId),
    },
  });
}

export async function recordExamAssessmentUnlinked(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  examSessionId: Types.ObjectId;
  examTimetableEntryId: Types.ObjectId;
  assessmentItemId: Types.ObjectId;
  classGroupId: Types.ObjectId;
}) {
  await recordActivity({
    schoolId: input.schoolId,
    userId: input.actorId,
    type: "exam.assessment.unlinked",
    entityType: "ExamTimetableEntry",
    entityId: input.examTimetableEntryId,
    description: "Assessment item unlinked from exam timetable entry.",
    metadata: {
      examSessionId: String(input.examSessionId),
      assessmentItemId: String(input.assessmentItemId),
      classGroupId: String(input.classGroupId),
    },
  });
}
