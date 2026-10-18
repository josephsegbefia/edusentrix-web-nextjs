import { Schema, model, models, type Model, type Types } from "mongoose";

export const ASSESSMENT_DEFINITION_STATUSES = [
  "draft",
  "review",
  "approved",
  "published",
  "superseded",
  "archived",
] as const;

export const ASSESSMENT_DEFINITION_RESULT_BINDINGS = [
  "none",
  "score_bearing",
] as const;

export type AssessmentDefinitionStatus =
  (typeof ASSESSMENT_DEFINITION_STATUSES)[number];
export type AssessmentDefinitionResultBinding =
  (typeof ASSESSMENT_DEFINITION_RESULT_BINDINGS)[number];

export interface IAssessmentDefinitionOptionSnapshot {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
}

export interface IAssessmentDefinitionSubQuestionSnapshot {
  label: string;
  prompt: string;
  marks: number;
  expectedAnswer: string | null;
  markingGuide: string | null;
}

export interface IAssessmentDefinitionAttachmentSnapshot {
  id: string;
  type: string;
  url: string;
  uploadKey: string | null;
  fileName: string | null;
  mimeType: string | null;
  caption: string | null;
  altText: string | null;
  displayMode: string;
}

export interface IAssessmentDefinitionQuestionSnapshot {
  sourceQuestionId: Types.ObjectId;
  sourceQuestionBankItemId: Types.ObjectId | null;
  sectionId: Types.ObjectId | null;
  order: number;
  type: string;
  prompt: string;
  plainTextPrompt: string | null;
  options: IAssessmentDefinitionOptionSnapshot[];
  subQuestions: IAssessmentDefinitionSubQuestionSnapshot[];
  marks: number;
  difficulty: string;
  topic: string | null;
  subtopic: string | null;
  curriculumNodeIds: Types.ObjectId[];
  schemeItemIds: Types.ObjectId[];
  lessonIds: Types.ObjectId[];
  lessonNoteIds: Types.ObjectId[];
  expectedAnswer: string | null;
  markingGuide: string | null;
  explanation: string | null;
  attachments: IAssessmentDefinitionAttachmentSnapshot[];
}

export interface IAssessmentDefinitionSectionSnapshot {
  sourceSectionId: Types.ObjectId;
  title: string;
  instructions: string | null;
  order: number;
  marks: number;
  questions: IAssessmentDefinitionQuestionSnapshot[];
}

export interface IAssessmentDefinitionResourceManifestEntry {
  resourceId: string;
  sourceQuestionId: Types.ObjectId;
  sourceAttachmentId: string;
  type: string;
  sourceUrl: string;
  uploadKey: string | null;
  fileName: string | null;
  mimeType: string | null;
  visibility: "private";
  integrityAlgorithm: "sha256";
  integrityDigest: string | null;
  integrityStatus: "unverified";
}

export interface IAssessmentDefinitionScoringSnapshot {
  maximumMarks: number;
  questionMarksTotal: number;
  policy: "raw_marks";
  scoreBearing: boolean;
  contributesToCanonicalAcademicEngine: boolean;
}

export interface IAssessmentDefinitionVersion {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  definitionKey: string;
  sourceExamPaperId: Types.ObjectId;
  version: number;
  supersedesVersionId?: Types.ObjectId | null;
  status: AssessmentDefinitionStatus;
  title: string;
  examTypeId: Types.ObjectId;
  academicYearId: Types.ObjectId;
  termId?: Types.ObjectId | null;
  academicPeriodId?: Types.ObjectId | null;
  scope: string;
  gradeId: Types.ObjectId;
  classGroupIds: Types.ObjectId[];
  subjectId: Types.ObjectId;
  subjectOfferingId?: Types.ObjectId | null;
  durationMinutes?: number | null;
  instructions: string | null;
  candidateInstructions: string | null;
  resultBinding: AssessmentDefinitionResultBinding;
  assessmentPlanId?: Types.ObjectId | null;
  assessmentItemId?: Types.ObjectId | null;
  scoring: IAssessmentDefinitionScoringSnapshot;
  sections: IAssessmentDefinitionSectionSnapshot[];
  resourceManifest: IAssessmentDefinitionResourceManifestEntry[];
  contentHash: string;
  contentHashAlgorithm: "sha256";
  attribution: {
    authorId: Types.ObjectId;
    reviewerId: Types.ObjectId;
    publisherId: Types.ObjectId;
  };
  publishedAt?: Date | null;
  supersededAt?: Date | null;
  archivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const optionSchema = new Schema<IAssessmentDefinitionOptionSnapshot>(
  {
    id: { type: String, required: true, trim: true, maxlength: 40 },
    label: { type: String, required: true, trim: true, maxlength: 12 },
    text: { type: String, required: true, trim: true, maxlength: 8000 },
    isCorrect: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const subQuestionSchema = new Schema<IAssessmentDefinitionSubQuestionSnapshot>(
  {
    label: { type: String, required: true, trim: true, maxlength: 20 },
    prompt: { type: String, required: true, trim: true, maxlength: 12000 },
    marks: { type: Number, required: true, min: 0 },
    expectedAnswer: { type: String, default: null, maxlength: 20000 },
    markingGuide: { type: String, default: null, maxlength: 20000 },
  },
  { _id: false }
);

const attachmentSchema = new Schema<IAssessmentDefinitionAttachmentSnapshot>(
  {
    id: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, required: true, trim: true, maxlength: 80 },
    url: { type: String, required: true, trim: true, maxlength: 4000 },
    uploadKey: { type: String, default: null, maxlength: 1000 },
    fileName: { type: String, default: null, maxlength: 500 },
    mimeType: { type: String, default: null, maxlength: 200 },
    caption: { type: String, default: null, maxlength: 1000 },
    altText: { type: String, default: null, maxlength: 1000 },
    displayMode: { type: String, required: true, maxlength: 80 },
  },
  { _id: false }
);

const questionSchema = new Schema<IAssessmentDefinitionQuestionSnapshot>(
  {
    sourceQuestionId: { type: Schema.Types.ObjectId, required: true },
    sourceQuestionBankItemId: { type: Schema.Types.ObjectId, default: null },
    sectionId: { type: Schema.Types.ObjectId, default: null },
    order: { type: Number, required: true, min: 0 },
    type: { type: String, required: true, trim: true, maxlength: 80 },
    prompt: { type: String, required: true, maxlength: 30000 },
    plainTextPrompt: { type: String, default: null, maxlength: 30000 },
    options: { type: [optionSchema], default: [] },
    subQuestions: { type: [subQuestionSchema], default: [] },
    marks: { type: Number, required: true, min: 0 },
    difficulty: { type: String, required: true, maxlength: 40 },
    topic: { type: String, default: null, maxlength: 240 },
    subtopic: { type: String, default: null, maxlength: 240 },
    curriculumNodeIds: { type: [Schema.Types.ObjectId], default: [] },
    schemeItemIds: { type: [Schema.Types.ObjectId], default: [] },
    lessonIds: { type: [Schema.Types.ObjectId], default: [] },
    lessonNoteIds: { type: [Schema.Types.ObjectId], default: [] },
    expectedAnswer: { type: String, default: null, maxlength: 30000 },
    markingGuide: { type: String, default: null, maxlength: 30000 },
    explanation: { type: String, default: null, maxlength: 20000 },
    attachments: { type: [attachmentSchema], default: [] },
  },
  { _id: false }
);

const sectionSchema = new Schema<IAssessmentDefinitionSectionSnapshot>(
  {
    sourceSectionId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    instructions: { type: String, default: null, maxlength: 4000 },
    order: { type: Number, required: true, min: 0 },
    marks: { type: Number, required: true, min: 0 },
    questions: { type: [questionSchema], default: [] },
  },
  { _id: false }
);

const resourceManifestSchema = new Schema<IAssessmentDefinitionResourceManifestEntry>(
  {
    resourceId: { type: String, required: true, trim: true, maxlength: 200 },
    sourceQuestionId: { type: Schema.Types.ObjectId, required: true },
    sourceAttachmentId: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, required: true, trim: true, maxlength: 80 },
    sourceUrl: { type: String, required: true, trim: true, maxlength: 4000 },
    uploadKey: { type: String, default: null, maxlength: 1000 },
    fileName: { type: String, default: null, maxlength: 500 },
    mimeType: { type: String, default: null, maxlength: 200 },
    visibility: { type: String, enum: ["private"], required: true },
    integrityAlgorithm: { type: String, enum: ["sha256"], required: true },
    integrityDigest: { type: String, default: null, maxlength: 128 },
    integrityStatus: { type: String, enum: ["unverified"], required: true },
  },
  { _id: false }
);

const assessmentDefinitionVersionSchema = new Schema<IAssessmentDefinitionVersion>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    definitionKey: { type: String, required: true, trim: true, maxlength: 200, index: true },
    sourceExamPaperId: { type: Schema.Types.ObjectId, ref: "ExamPaper", required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    supersedesVersionId: {
      type: Schema.Types.ObjectId,
      ref: "AssessmentDefinitionVersion",
      default: null,
    },
    status: {
      type: String,
      enum: [...ASSESSMENT_DEFINITION_STATUSES],
      required: true,
      default: "published",
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 220 },
    examTypeId: { type: Schema.Types.ObjectId, ref: "ExamType", required: true },
    academicYearId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", required: true },
    termId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", default: null },
    academicPeriodId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", default: null },
    scope: { type: String, required: true, trim: true, maxlength: 80 },
    gradeId: { type: Schema.Types.ObjectId, ref: "Grade", required: true },
    classGroupIds: { type: [Schema.Types.ObjectId], ref: "ClassGroup", default: [] },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    subjectOfferingId: { type: Schema.Types.ObjectId, ref: "SubjectOffering", default: null },
    durationMinutes: { type: Number, default: null, min: 1 },
    instructions: { type: String, default: null, maxlength: 8000 },
    candidateInstructions: { type: String, default: null, maxlength: 8000 },
    resultBinding: {
      type: String,
      enum: [...ASSESSMENT_DEFINITION_RESULT_BINDINGS],
      required: true,
    },
    assessmentPlanId: { type: Schema.Types.ObjectId, ref: "AssessmentPlan", default: null },
    assessmentItemId: { type: Schema.Types.ObjectId, ref: "AssessmentItem", default: null },
    scoring: {
      maximumMarks: { type: Number, required: true, min: 0 },
      questionMarksTotal: { type: Number, required: true, min: 0 },
      policy: { type: String, enum: ["raw_marks"], required: true },
      scoreBearing: { type: Boolean, required: true },
      contributesToCanonicalAcademicEngine: { type: Boolean, required: true },
    },
    sections: { type: [sectionSchema], default: [] },
    resourceManifest: { type: [resourceManifestSchema], default: [] },
    contentHash: { type: String, required: true, trim: true, length: 64 },
    contentHashAlgorithm: { type: String, enum: ["sha256"], required: true },
    attribution: {
      authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      reviewerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      publisherId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    },
    publishedAt: { type: Date, default: null },
    supersededAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

assessmentDefinitionVersionSchema.index(
  { schoolId: 1, definitionKey: 1, version: 1 },
  { unique: true, name: "assess_definition_version_unique" }
);
assessmentDefinitionVersionSchema.index(
  { schoolId: 1, definitionKey: 1, contentHash: 1 },
  { unique: true, name: "assess_definition_content_hash_unique" }
);
assessmentDefinitionVersionSchema.index({ schoolId: 1, sourceExamPaperId: 1, version: -1 });
assessmentDefinitionVersionSchema.index({ schoolId: 1, status: 1, updatedAt: -1 });

const LIFECYCLE_UPDATE_PATHS = new Set([
  "status",
  "publishedAt",
  "supersededAt",
  "archivedAt",
  "createdAt",
  "updatedAt",
]);

function getUpdatePaths(update: Record<string, unknown>) {
  return Object.keys(update).flatMap((operator) => {
    const value = update[operator];
    if (operator.startsWith("$")) {
      return value && typeof value === "object"
        ? Object.keys(value as Record<string, unknown>)
        : [];
    }
    return [operator];
  });
}

function assertLifecycleOnlyUpdate(update: unknown) {
  if (!update || typeof update !== "object") {
    throw new Error("Published assessment definitions are immutable");
  }
  const paths = getUpdatePaths(update as Record<string, unknown>);
  if (
    paths.some((path) => !LIFECYCLE_UPDATE_PATHS.has(path)) ||
    !["superseded", "archived"].includes(
      String((update as Record<string, Record<string, unknown>>).$set?.status ?? "")
    )
  ) {
    throw new Error("Published assessment definitions are immutable");
  }
}

assessmentDefinitionVersionSchema.pre("findOneAndUpdate", function () {
  assertLifecycleOnlyUpdate(this.getUpdate());
});

assessmentDefinitionVersionSchema.pre("updateOne", function () {
  assertLifecycleOnlyUpdate(this.getUpdate());
});

assessmentDefinitionVersionSchema.pre("updateMany", function () {
  assertLifecycleOnlyUpdate(this.getUpdate());
});

assessmentDefinitionVersionSchema.pre("save", async function () {
  if (this.isNew) return;
  const existing = await (this.constructor as Model<IAssessmentDefinitionVersion>)
    .findById(this._id)
    .select("status")
    .lean<{ status: AssessmentDefinitionStatus }>();
  if (!existing || !["published", "superseded", "archived"].includes(existing.status)) {
    return;
  }
  const changed = this.modifiedPaths().filter((path) => path !== "updatedAt");
  if (changed.some((path) => !LIFECYCLE_UPDATE_PATHS.has(path))) {
    throw new Error("Published assessment definitions are immutable");
  }
});

export const AssessmentDefinitionVersion: Model<IAssessmentDefinitionVersion> =
  (models.AssessmentDefinitionVersion as Model<IAssessmentDefinitionVersion>) ||
  model<IAssessmentDefinitionVersion>(
    "AssessmentDefinitionVersion",
    assessmentDefinitionVersionSchema
  );
