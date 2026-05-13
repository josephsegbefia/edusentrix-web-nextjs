import { Schema, model, models, type Model, type Types } from "mongoose";

export const SCHOOL_IMPLEMENTATION_STATUSES = [
  "not_started",
  "in_progress",
  "blocked",
  "ready_for_review",
  "ready_for_go_live",
  "completed",
] as const;

export type SchoolImplementationStatus = (typeof SCHOOL_IMPLEMENTATION_STATUSES)[number];
export type SchoolImplementationChecklistStatus = "pending" | "in_progress" | "done" | "blocked";

export const DEFAULT_IMPLEMENTATION_CHECKLIST = [
  { key: "confirm_school_profile", label: "Confirm school profile" },
  { key: "set_subscription", label: "Set subscription/trial/pilot" },
  { key: "create_academic_year", label: "Create academic year and current term" },
  { key: "create_grades", label: "Create grades" },
  { key: "create_class_groups", label: "Create class groups" },
  { key: "create_subjects", label: "Create subjects" },
  { key: "add_school_admins", label: "Add school admins" },
  { key: "add_teachers", label: "Add teachers" },
  { key: "assign_teachers", label: "Assign teachers to subjects/class groups" },
  { key: "add_students", label: "Add students" },
  { key: "link_guardians", label: "Link parents/guardians" },
  { key: "daily_schedule", label: "Create school daily schedule" },
  { key: "timetable_basics", label: "Create class schedules/timetable basics" },
  { key: "fees", label: "Set up fees" },
  { key: "invoices", label: "Generate invoices if required" },
  { key: "payment_setup", label: "Review payment setup" },
  { key: "communication", label: "Prepare communication templates" },
  { key: "go_live_checks", label: "Run go-live checks" },
  { key: "mark_go_live", label: "Mark school ready for go-live" },
] as const;

export interface ISchoolImplementationProject {
  _id: Types.ObjectId;
  schoolId: Types.ObjectId;
  status: SchoolImplementationStatus;
  assignedOwnerUserId?: Types.ObjectId | null;
  startDate?: Date | null;
  targetGoLiveDate?: Date | null;
  completedAt?: Date | null;
  checklist: Array<{
    key: string;
    label: string;
    status: SchoolImplementationChecklistStatus;
    assignedToUserId?: Types.ObjectId | null;
    completedAt?: Date | null;
    completedByUserId?: Types.ObjectId | null;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const SchoolImplementationProjectSchema = new Schema<ISchoolImplementationProject>(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: "School", required: true, unique: true, index: true },
    status: { type: String, enum: SCHOOL_IMPLEMENTATION_STATUSES, default: "not_started", index: true },
    assignedOwnerUserId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    startDate: { type: Date, default: null },
    targetGoLiveDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    checklist: {
      type: [
        {
          key: { type: String, required: true },
          label: { type: String, required: true, trim: true },
          status: {
            type: String,
            enum: ["pending", "in_progress", "done", "blocked"],
            default: "pending",
          },
          assignedToUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
          completedAt: { type: Date, default: null },
          completedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
        },
      ],
      default: () =>
        DEFAULT_IMPLEMENTATION_CHECKLIST.map((item) => ({
          ...item,
          status: "pending",
        })),
    },
  },
  { timestamps: true }
);

SchoolImplementationProjectSchema.index({ status: 1, targetGoLiveDate: 1 });

export const SchoolImplementationProject: Model<ISchoolImplementationProject> =
  (models.SchoolImplementationProject as Model<ISchoolImplementationProject>) ||
  model<ISchoolImplementationProject>(
    "SchoolImplementationProject",
    SchoolImplementationProjectSchema
  );
