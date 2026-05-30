import { Schema, model, models, Types, type Model } from "mongoose";

export type AssessmentMarksAuditAction =
  | "assessment_item.created"
  | "assessment_item.updated"
  | "assessment_item.archived"
  | "assessment_scores.bulk_updated"
  | "subject_results.submitted"
  | "studio.gradebook_linked";

export interface IAssessmentMarksAuditLog {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  teacherId: Types.ObjectId;
  action: AssessmentMarksAuditAction;
  entityType: "assessment_item" | "assessment_score_batch" | "subject_result_batch";
  entityId?: Types.ObjectId | null;
  classGroupId: Types.ObjectId;
  subjectId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  assessmentPlanId: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const assessmentMarksAuditLogSchema = new Schema<IAssessmentMarksAuditLog>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "assessment_item.created",
        "assessment_item.updated",
        "assessment_item.archived",
        "assessment_scores.bulk_updated",
        "subject_results.submitted",
        "studio.gradebook_linked",
      ],
    },
    entityType: {
      type: String,
      required: true,
      enum: ["assessment_item", "assessment_score_batch", "subject_result_batch"],
    },
    entityId: { type: Schema.Types.ObjectId, default: null },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    academicPeriodId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicPeriod",
      required: true,
      index: true,
    },
    assessmentPlanId: {
      type: Schema.Types.ObjectId,
      ref: "AssessmentPlan",
      required: true,
      index: true,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

assessmentMarksAuditLogSchema.index(
  { schoolId: 1, classGroupId: 1, subjectId: 1, createdAt: -1 },
  { name: "ae_marks_audit_by_class_subject" }
);

export const AssessmentMarksAuditLog: Model<IAssessmentMarksAuditLog> =
  (models.AssessmentMarksAuditLog as Model<IAssessmentMarksAuditLog>) ||
  model<IAssessmentMarksAuditLog>(
    "AssessmentMarksAuditLog",
    assessmentMarksAuditLogSchema
  );
