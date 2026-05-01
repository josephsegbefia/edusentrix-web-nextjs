import { Schema, model, models, type Model, type Types } from "mongoose";

/**
 * Student-facing lesson instance created from a LessonNote.
 * Many lessons may reference the same note (reteach, reschedule).
 */
export type LessonDeliveryStatus = "draft" | "published" | "archived";

/** Frozen instructional payload copied from the lesson note at publish time. */
export interface ILessonPublishedSnapshot {
  topic: string;
  templateType: string;
  curriculumCode?: string;
  references: string[];
  curriculum?: unknown;
  tlms: string[];
  body: unknown;
  assessment?: unknown;
  resources: Array<{ title: string; url: string; type?: string }>;
  durationMinutes: number | null;
}

export interface ILessonTeachingSegment {
  title: string;
  durationMinutes?: number;
  teacherPrompt?: string;
  learnerActivity?: string;
  notes?: string;
}

export interface ILessonTeachingMode {
  segments: ILessonTeachingSegment[];
}

export interface ILesson {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  /** Authoring teacher (copied from the lesson note). */
  teacherId: Types.ObjectId;
  lessonNoteId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectId?: Types.ObjectId;
  academicPeriodId?: Types.ObjectId;

  title: string;
  /** When the lesson is scheduled for delivery (optional). */
  scheduledAt?: Date;

  status: LessonDeliveryStatus;
  publishedAt?: Date;
  /** Present when status has been `published` at least once (cleared when returned to `draft`). */
  publishedSnapshot?: ILessonPublishedSnapshot | null;
  /** Teacher-facing delivery plan (segments, prompts); optional. */
  teachingMode?: ILessonTeachingMode | null;
  /**
   * Teacher-approved HTML for caregivers, when the school enables parent-facing summaries.
   * Never exposed to students; parents see it only via guardian APIs when `SchoolSettings.lessonsModule` allows.
   */
  parentSummaryHtml?: string | null;
  /**
   * Optional explicit co-authors (teacher IDs). These teachers can open and collaborate
   * on this lesson in addition to assignment-based co-teachers.
   */
  collaboratorTeacherIds?: Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
}

const lessonTeachingSegmentSchema = new Schema<ILessonTeachingSegment>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    durationMinutes: { type: Number, min: 0, max: 600 },
    teacherPrompt: { type: String, trim: true, maxlength: 8000 },
    learnerActivity: { type: String, trim: true, maxlength: 8000 },
    notes: { type: String, trim: true, maxlength: 8000 },
  },
  { _id: false }
);

const lessonTeachingModeSchema = new Schema<ILessonTeachingMode>(
  {
    segments: { type: [lessonTeachingSegmentSchema], default: [] },
  },
  { _id: false }
);

const lessonSchema = new Schema<ILesson>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, index: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, index: true },
    lessonNoteId: {
      type: Schema.Types.ObjectId,
      ref: "LessonNote",
      required: true,
      index: true,
    },
    classGroupId: { type: Schema.Types.ObjectId, ref: "ClassGroup", required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject", index: true },
    academicPeriodId: { type: Schema.Types.ObjectId, ref: "AcademicPeriod", index: true },

    title: { type: String, required: true, trim: true, maxlength: 220 },
    scheduledAt: { type: Date },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    publishedAt: { type: Date },
    publishedSnapshot: { type: Schema.Types.Mixed, default: null },
    teachingMode: { type: lessonTeachingModeSchema, default: null },
    parentSummaryHtml: { type: String, default: null, maxlength: 48_000 },
    collaboratorTeacherIds: [{ type: Schema.Types.ObjectId, ref: "Teacher", index: true }],
  },
  { timestamps: true }
);

lessonSchema.index({ schoolId: 1, teacherId: 1, updatedAt: -1 });
lessonSchema.index({ schoolId: 1, lessonNoteId: 1, createdAt: -1 });
lessonSchema.index({ schoolId: 1, classGroupId: 1, status: 1 });

export const Lesson: Model<ILesson> =
  (models.Lesson as Model<ILesson>) || model<ILesson>("Lesson", lessonSchema);
