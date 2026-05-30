import { Schema } from "mongoose";
import {
  ASSESSMENT_ENGINE_ASSESSMENT_TYPES,
  ASSESSMENT_ITEM_STATUSES,
  ASSESSMENT_ITEM_VISIBILITIES,
  ASSESSMENT_PLAN_STATUSES,
  ASSESSMENT_SCORE_STATUSES,
  ASSESSMENT_SOURCE_TYPES,
  CONTRIBUTION_MODES,
  GRADE_LABEL_MODES,
  GRADING_POLICY_STATUSES,
  MISSING_SCORE_POLICIES,
  REPORT_APPROVAL_ACTIONS,
  REPORT_APPROVAL_ENTITY_TYPES,
  REPORT_ATTENDANCE_SNAPSHOT_SOURCES,
  REPORT_CARD_RUN_STATUSES,
  ROUNDING_RULES,
  STUDENT_REPORT_CARD_STATUSES,
  SUBJECT_RESULT_STATUSES,
} from "@/constants/academics/assessment-engine";

export const scoreComponentSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    weight: { type: Number, required: true, min: 0, max: 100 },
    order: { type: Number, required: true, default: 0 },
    required: { type: Boolean, required: true, default: false },
    allowedAssessmentTypes: { type: [String], default: [] },
  },
  { _id: false }
);

export const gradeBoundarySchema = new Schema(
  {
    minPercentage: { type: Number, required: true, min: 0, max: 100 },
    maxPercentage: { type: Number, required: true, min: 0, max: 100 },
    gradeLabel: { type: String, required: true, trim: true },
    gradePoint: { type: Number, default: null },
    descriptor: { type: String, default: null },
    isPassing: { type: Boolean, default: true },
    colorToken: { type: String, default: null },
  },
  { _id: false }
);

export const componentRuleSchema = new Schema(
  {
    componentKey: { type: String, required: true, trim: true },
    contributionMode: {
      type: String,
      enum: [...CONTRIBUTION_MODES],
      required: true,
    },
    minItems: { type: Number, min: 0, default: undefined },
    maxItems: { type: Number, min: 0, default: undefined },
    bestN: { type: Number, min: 1, default: undefined },
    latestN: { type: Number, min: 1, default: undefined },
    dropLowestCount: { type: Number, min: 0, default: undefined },
    requiredAssessmentTypes: { type: [String], default: undefined },
    requiredItemLabels: { type: [String], default: undefined },
    allowManualOverride: { type: Boolean, default: false },
    requireHomeroomApproval: { type: Boolean, default: false },
    requireAdminApproval: { type: Boolean, default: false },
  },
  { _id: false }
);

export const minimumCompletionRuleSchema = new Schema(
  {
    componentKey: { type: String, trim: true, default: undefined },
    minItems: { type: Number, min: 0, default: undefined },
    minPercentageComplete: { type: Number, min: 0, max: 100, default: undefined },
    requireSubjectRemark: { type: Boolean, default: false },
    blockSubmissionWhenMissing: { type: Boolean, default: false },
  },
  { _id: false }
);

export const subjectResultComponentSnapshotSchema = new Schema(
  {
    componentKey: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    weight: { type: Number, required: true, min: 0, max: 100 },
    rawScore: { type: Number, required: true, default: 0 },
    rawMaxScore: { type: Number, required: true, default: 0 },
    rawPercentage: { type: Number, required: true, default: 0 },
    weightedScore: { type: Number, required: true, default: 0 },
    includedAssessmentItemIds: {
      type: [Schema.Types.ObjectId],
      default: [],
    },
    excludedAssessmentItemIds: {
      type: [Schema.Types.ObjectId],
      default: [],
    },
    calculationMode: {
      type: String,
      enum: [...CONTRIBUTION_MODES],
      required: true,
    },
  },
  { _id: false }
);

export const reportCardRunReadinessSnapshotSchema = new Schema(
  {
    subjectsExpected: { type: Number, required: true, default: 0 },
    subjectsSubmitted: { type: Number, required: true, default: 0 },
    subjectsApproved: { type: Number, required: true, default: 0 },
    studentsExpected: { type: Number, required: true, default: 0 },
    studentsComplete: { type: Number, required: true, default: 0 },
    missingSubjectResults: { type: [String], default: [] },
    missingExamScores: { type: [String], default: [] },
    missingRequiredComponents: { type: [String], default: [] },
    attendanceReady: { type: Boolean, required: true, default: false },
    commentsReady: { type: Boolean, required: true, default: false },
    headteacherCommentReady: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

export const reportCardRunIssueSummarySchema = new Schema(
  {
    code: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    severity: {
      type: String,
      enum: ["info", "warning", "error"],
      required: true,
      default: "warning",
    },
    entityType: {
      type: String,
      enum: [...REPORT_APPROVAL_ENTITY_TYPES],
      default: undefined,
    },
    entityId: { type: String, default: undefined },
  },
  { _id: false }
);

export {
  GRADE_LABEL_MODES,
  ROUNDING_RULES,
  GRADING_POLICY_STATUSES,
  ASSESSMENT_PLAN_STATUSES,
  ASSESSMENT_SOURCE_TYPES,
  ASSESSMENT_ITEM_VISIBILITIES,
  ASSESSMENT_ITEM_STATUSES,
  ASSESSMENT_SCORE_STATUSES,
  MISSING_SCORE_POLICIES,
  SUBJECT_RESULT_STATUSES,
  REPORT_CARD_RUN_STATUSES,
  STUDENT_REPORT_CARD_STATUSES,
  REPORT_ATTENDANCE_SNAPSHOT_SOURCES,
  REPORT_APPROVAL_ENTITY_TYPES,
  REPORT_APPROVAL_ACTIONS,
  ASSESSMENT_ENGINE_ASSESSMENT_TYPES,
};
