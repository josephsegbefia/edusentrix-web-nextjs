import { z } from "zod";

/** Form row: gradeId is UI-only (filters class groups); strip before POST body if needed. */
const TeachingAssignmentFormRowSchema = z.object({
  subjectId: z.string().trim().optional().default(""),
  classGroupId: z.string().trim().optional().default(""),
  gradeId: z.string().trim().optional().default(""),
});

export const CreateTeacherSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    phone: z.string().trim().optional(),
    photoUrl: z
      .union([
        z.string().url("Invalid photo URL"),
        z.literal(""),
      ])
      .optional(),
    /** Extra subject capabilities without a class assignment (optional). */
    subjectIds: z.array(z.string().trim()).optional().default([]),
    /** Subject + class group pairs for the current academic term (creates TeacherAssignment rows). */
    teachingAssignments: z
      .array(TeachingAssignmentFormRowSchema)
      .optional()
      .default([]),
    homeroomClassGroupId: z.union([z.string().trim(), z.literal("")]).optional(),
    status: z.enum(["active", "inactive"]),
    /** When creating assignments, if another teacher already teaches this subject in that class for the term. */
    teachingAssignmentResolution: z
      .enum(["add_alongside", "replace", "skip"])
      .optional(),
  });

export type CreateTeacherInput = z.infer<typeof CreateTeacherSchema>;
export type TeachingAssignmentFormRow = z.infer<
  typeof TeachingAssignmentFormRowSchema
>;

// Emergency contact schema for teacher updates
const EmergencyContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  relationship: z.string().trim().min(1, "Relationship is required"),
  phone: z.string().trim().min(1, "Phone is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
}).optional().nullable();

// Qualification schema for teacher updates
const QualificationSchema = z.object({
  type: z.enum(["degree", "diploma", "certificate", "other"]),
  name: z.string().trim().min(1, "Name is required"),
  institution: z.string().trim().min(1, "Institution is required"),
  year: z.number().min(1900).max(2100),
  documentUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
});

// Update teacher schema - all fields optional for partial updates
export const UpdateTeacherSchema = z.object({
  // User fields (updates User model)
  firstName: z.string().trim().min(1, "First name is required").optional(),
  lastName: z.string().trim().min(1, "Last name is required").optional(),
  email: z.string().email("Invalid email address").optional(),
  phone: z.string().trim().optional().nullable(),
  photoUrl: z
    .union([z.string().url("Invalid photo URL"), z.literal("")])
    .optional()
    .nullable(),
  /** UploadThing file key; used when replacing avatars. */
  avatarPublicId: z.string().trim().max(240).optional().nullable(),

  // Teacher status
  status: z.enum(["active", "inactive", "on_leave", "terminated"]).optional(),

  // Professional information
  employeeId: z.string().trim().optional().nullable(),
  department: z.string().trim().optional().nullable(),
  hireDate: z.string().optional().nullable(), // ISO date string
  terminationDate: z.string().optional().nullable(), // ISO date string
  leaveStartDate: z.string().optional().nullable(), // ISO date string or YYYY-MM-DD
  leaveEndDate: z.string().optional().nullable(), // ISO date string or YYYY-MM-DD
  leaveReason: z.string().trim().max(500).optional().nullable(),

  // Capacity
  maxClasses: z.number().min(0).optional().nullable(),
  maxStudents: z.number().min(0).optional().nullable(),

  // Emergency contact
  emergencyContact: EmergencyContactSchema,

  // Qualifications
  qualifications: z.array(QualificationSchema).optional(),

  // Assignments
  subjectIds: z.array(z.string().trim()).optional(),
  homeroomClassGroupId: z.union([z.string().trim(), z.literal("")]).optional().nullable(),

  // Internal notes and tags
  notes: z.string().trim().optional().nullable(),
  tags: z.array(z.string().trim()).optional(),
}).superRefine((data, ctx) => {
  if (data.status !== "on_leave") return;

  if (!data.leaveStartDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["leaveStartDate"],
      message: "Leave start date is required when status is On Leave",
    });
  }

  if (!data.leaveEndDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["leaveEndDate"],
      message: "Leave end date is required when status is On Leave",
    });
  }

  if (!data.leaveStartDate || !data.leaveEndDate) return;

  const start = new Date(data.leaveStartDate);
  const end = new Date(data.leaveEndDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

  if (end < start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["leaveEndDate"],
      message: "Leave end date must be on or after leave start date",
    });
  }
});

export type UpdateTeacherInput = z.infer<typeof UpdateTeacherSchema>;

// ============== TEACHER ASSIGNMENT SCHEMAS ==============

// Update teacher assignment schema - all fields optional for partial updates
export const UpdateTeacherAssignmentSchema = z.object({
  // Core assignment fields
  subjectId: z.string().min(1, "Subject is required").optional(),
  classGroupId: z.string().min(1, "Class group is required").optional(),
  academicPeriodId: z.string().min(1, "Academic period is required").optional(),

  // Status
  status: z.enum(["active", "inactive"]).optional(),

  // Other fields
  workloadHours: z.coerce.number().min(0).max(80).optional(),
  notes: z.string().max(500).optional().nullable(),
});

export type UpdateTeacherAssignmentInput = z.infer<typeof UpdateTeacherAssignmentSchema>;

// ============== TEACHER PERFORMANCE SCHEMAS ==============

export const CreateEvaluationSchema = z.object({
  academicPeriodId: z.string().min(1, "Academic period is required"),
  overallRating: z.number().min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
  strengths: z.array(z.string().trim().min(1)).default([]),
  areasForImprovement: z.array(z.string().trim().min(1)).default([]),
  goals: z.array(z.string().trim().min(1)).default([]),
  comments: z.string().trim().max(2000).optional(),
});

export type CreateEvaluationInput = z.output<typeof CreateEvaluationSchema>;
export type CreateEvaluationFormInput = z.input<typeof CreateEvaluationSchema>;
