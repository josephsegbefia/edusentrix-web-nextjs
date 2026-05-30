import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  AssessmentMarksAuditLog,
  type AssessmentMarksAuditAction,
} from "@/models/AssessmentMarksAuditLog";

export async function recordAssessmentMarksAudit(input: {
  schoolId: mongoose.Types.ObjectId;
  actorUserId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  action: AssessmentMarksAuditAction;
  entityType: "assessment_item" | "assessment_score_batch" | "subject_result_batch";
  entityId?: mongoose.Types.ObjectId | null;
  classGroupId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  assessmentPlanId: mongoose.Types.ObjectId;
  metadata?: Record<string, unknown>;
}) {
  try {
    await connectToDatabase();
    await AssessmentMarksAuditLog.create({
      schoolId: input.schoolId,
      actorUserId: input.actorUserId,
      teacherId: input.teacherId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      classGroupId: input.classGroupId,
      subjectId: input.subjectId,
      academicPeriodId: input.academicPeriodId,
      assessmentPlanId: input.assessmentPlanId,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    console.error("[assessment-engine] recordAssessmentMarksAudit failed:", error);
  }
}
