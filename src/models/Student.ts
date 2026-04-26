// src/models/Student.ts
import { Schema, model, models, Types, type Model } from "mongoose";
import type { IClassGroup } from "./ClassGroup";
import type { IGrade } from "./Grade";

/** Snapshot of files from an admissions application at provision time. */
export interface IStudentEnrollmentDocument {
  requirementId: string;
  label: string;
  fileUrl: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  uploadedAt?: Date | null;
}

/** Files uploaded by school staff from the student profile (admin UI). */
export interface IStudentRecordDocument {
  _id: Types.ObjectId;
  name: string;
  type: string;
  fileUrl: string;
  fileMime?: string | null;
  fileSize?: number | null;
  notes?: string | null;
  uploadedAt: Date;
  uploadedBy?: Types.ObjectId | null;
}

/** Guardian document request (secure upload link), same pattern as admissions supplemental. */
export interface IStudentParentDocumentRequest {
  _id?: Types.ObjectId;
  token: string;
  label: string;
  message?: string | null;
  requestedAt: Date;
  requestedBy?: Types.ObjectId | null;
  fulfilledAt?: Date | null;
}

export interface IStudent {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  /** Set when created from platform application enrollment (CRM-lite). */
  platformApplicationId?: Types.ObjectId | null;
  /** Set when this student row was created from an admission application. */
  admissionApplicationId?: Types.ObjectId | null;
  userId?: Types.ObjectId | null; // optional link to User (Clerk-backed)
  admissionNo?: string | null;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  sex?: "male" | "female";
  dateOfBirth?: Date | null;

  gradeId: Types.ObjectId; // required
  classGroupId: Types.ObjectId; // required

  // Subject overrides relative to ClassGroup.subjectIds
  subjectAddIds?: Types.ObjectId[]; // extra subjects only this student takes
  subjectRemoveIds?: Types.ObjectId[]; // subjects this student does NOT take

  photoUrl?: string | null;
  /** Files copied from `AdmissionApplication.documents` when provisioned. */
  enrollmentDocuments?: IStudentEnrollmentDocument[];
  /** Staff-uploaded documents (report cards, medical forms, etc.). */
  recordDocuments?: IStudentRecordDocument[];
  /** Pending/fulfilled document requests sent to guardians (public upload link). */
  parentDocumentRequests?: IStudentParentDocumentRequest[];
  status: "active" | "inactive" | "withdrawn" | "graduated";
  enrolledAt?: Date | null;

  // GES (Ghana Education Service) fields — optional, can be attached later
  gesIndexNumber?: string | null; // JHS BECE index number
  gesSchoolCode?: string | null; // snapshot of the school's GES code at time of assignment

  // Promotion service (additive only — PROMOTION_SERVICE_SPEC §8.5)
  lastPromotionCycleId?: Types.ObjectId | null;
  promotionHistoryCount?: number;
  graduation?: {
    graduatedAt?: Date;
    graduatedFromGradeId?: Types.ObjectId;
  };

  createdAt: Date;
  updatedAt: Date;
}

const studentSchema = new Schema<IStudent>(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    platformApplicationId: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      default: null,
      index: true,
      sparse: true,
    },
    admissionApplicationId: {
      type: Schema.Types.ObjectId,
      ref: "AdmissionApplication",
      default: null,
      index: true,
      sparse: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },

    admissionNo: { type: String, default: null, trim: true },
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, default: null, trim: true },
    lastName: { type: String, required: true, trim: true },
    sex: { type: String, enum: ["male", "female"], default: "male" },
    dateOfBirth: { type: Date, default: null },

    gradeId: {
      type: Schema.Types.ObjectId,
      ref: "Grade",
      required: true,
      index: true,
    },
    classGroupId: {
      type: Schema.Types.ObjectId,
      ref: "ClassGroup",
      required: true,
      index: true,
    },

    subjectAddIds: [
      { type: Schema.Types.ObjectId, ref: "Subject", default: [] },
    ],
    subjectRemoveIds: [
      { type: Schema.Types.ObjectId, ref: "Subject", default: [] },
    ],

    photoUrl: { type: String, default: null },
    enrollmentDocuments: {
      type: [
        new Schema(
          {
            requirementId: { type: String, required: true },
            label: { type: String, required: true },
            fileUrl: { type: String, required: true },
            fileName: { type: String, default: null },
            mimeType: { type: String, default: null },
            sizeBytes: { type: Number, default: null },
            uploadedAt: { type: Date, default: null },
          },
          { _id: false }
        ),
      ],
      default: undefined,
    },
    recordDocuments: {
      type: [
        new Schema(
          {
            name: { type: String, required: true, trim: true },
            type: { type: String, required: true, trim: true },
            fileUrl: { type: String, required: true },
            fileMime: { type: String, default: null },
            fileSize: { type: Number, default: null },
            notes: { type: String, default: null },
            uploadedAt: { type: Date, default: () => new Date() },
            uploadedBy: {
              type: Schema.Types.ObjectId,
              ref: "User",
              default: null,
            },
          },
          { _id: true }
        ),
      ],
      default: undefined,
    },
    parentDocumentRequests: {
      type: [
        new Schema(
          {
            token: { type: String, required: true },
            label: { type: String, required: true },
            message: { type: String, default: null },
            requestedAt: { type: Date, default: () => new Date() },
            requestedBy: {
              type: Schema.Types.ObjectId,
              ref: "User",
              default: null,
            },
            fulfilledAt: { type: Date, default: null },
          },
          { _id: true }
        ),
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "inactive", "withdrawn", "graduated"],
      default: "active",
    },
    enrolledAt: { type: Date, default: null },

    gesIndexNumber: { type: String, default: null, trim: true },
    gesSchoolCode: { type: String, default: null, trim: true },

    lastPromotionCycleId: {
      type: Schema.Types.ObjectId,
      ref: "PromotionCycle",
      default: null,
    },
    promotionHistoryCount: { type: Number },
    graduation: {
      type: new Schema(
        {
          graduatedAt: { type: Date },
          graduatedFromGradeId: { type: Schema.Types.ObjectId, ref: "Grade" },
        },
        { _id: false }
      ),
    },
  },
  { timestamps: true }
);

// Useful lookups
studentSchema.index({ schoolId: 1, lastName: 1, firstName: 1 });
studentSchema.index({ schoolId: 1, classGroupId: 1 });
studentSchema.index(
  { "parentDocumentRequests.token": 1 },
  { unique: true, sparse: true }
);

// Guardrail: classGroup.schoolId & grade.schoolId must match student.schoolId
studentSchema.pre("save", async function (next) {
  try {
    const { ClassGroup } = await import("./ClassGroup");
    const { Grade } = await import("./Grade");
    const grpRaw = await ClassGroup.findById(this.classGroupId).lean();
    const grp = (Array.isArray(grpRaw) ? grpRaw[0] : grpRaw) as Pick<
      IClassGroup,
      "schoolId" | "gradeId"
    > | null;
    if (!grp) return next(new Error("ClassGroup not found"));

    const grdRaw = await Grade.findById(this.gradeId).lean();
    const grd = (Array.isArray(grdRaw) ? grdRaw[0] : grdRaw) as Pick<
      IGrade,
      "schoolId"
    > | null;
    if (!grd) return next(new Error("Grade not found"));

    if (String(grp.schoolId) !== String(this.schoolId)) {
      return next(new Error("Student.schoolId must match ClassGroup.schoolId"));
    }
    if (String(grd.schoolId) !== String(this.schoolId)) {
      return next(new Error("Student.schoolId must match Grade.schoolId"));
    }
    if (String(grp.gradeId) !== String(this.gradeId)) {
      return next(new Error("ClassGroup.gradeId must match Student.gradeId"));
    }
    next();
  } catch (e) {
    next(e instanceof Error ? e : new Error(String(e)));
  }
});

// Instance helper: resolve effective subjects
studentSchema.methods.getEffectiveSubjectIds = async function (): Promise<
  Types.ObjectId[]
> {
  const { ClassGroup } = await import("./ClassGroup");
  const grpRaw = await ClassGroup.findById(this.classGroupId)
    .select("subjectIds")
    .lean();
  const grpNormalized = Array.isArray(grpRaw) ? grpRaw[0] : grpRaw;
  const grp = grpNormalized as Pick<IClassGroup, "subjectIds"> | null;
  const base = new Set<string>(
    (grp?.subjectIds || []).map((id: Types.ObjectId) => String(id))
  );

  for (const add of this.subjectAddIds || []) base.add(String(add));
  for (const rem of this.subjectRemoveIds || []) base.delete(String(rem));

  return Array.from(base).map((id) => new Types.ObjectId(id));
};

export const Student: Model<IStudent> =
  (models.Student as Model<IStudent>) ||
  model<IStudent>("Student", studentSchema);
