import { z } from "zod";

export const CreateTeacherSchema = z.object({
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
  subjectIds: z.array(z.string().trim()),
  homeroomClassGroupId: z.union([z.string().trim(), z.literal("")]).optional(),
  status: z.enum(["active", "inactive"]),
});

export type CreateTeacherInput = z.infer<typeof CreateTeacherSchema>;

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

  // Teacher status
  status: z.enum(["active", "inactive", "on_leave", "terminated"]).optional(),

  // Professional information
  employeeId: z.string().trim().optional().nullable(),
  department: z.string().trim().optional().nullable(),
  hireDate: z.string().optional().nullable(), // ISO date string
  terminationDate: z.string().optional().nullable(), // ISO date string

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
});

export type UpdateTeacherInput = z.infer<typeof UpdateTeacherSchema>;

// ============== TEACHER ASSIGNMENT SCHEMAS ==============

// Schedule item schema for teacher assignments
const ScheduleItemSchema = z.object({
  dayOfWeek: z.coerce.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time must be HH:MM"),
  location: z.string().max(80).optional(),
});

// Update teacher assignment schema - all fields optional for partial updates
export const UpdateTeacherAssignmentSchema = z.object({
  // Core assignment fields
  subjectId: z.string().min(1, "Subject is required").optional(),
  classGroupId: z.string().min(1, "Class group is required").optional(),
  academicPeriodId: z.string().min(1, "Academic period is required").optional(),

  // Status
  status: z.enum(["active", "inactive"]).optional(),

  // Schedule - can be array of schedules or null to clear
  schedules: z.array(ScheduleItemSchema).optional().nullable(),

  // Other fields
  workloadHours: z.coerce.number().min(0).max(80).optional(),
  notes: z.string().max(500).optional().nullable(),
}).superRefine((val, ctx) => {
  // Validate schedule times if provided
  if (!val.schedules || val.schedules.length === 0) return;

  val.schedules.forEach((s, idx) => {
    if (s.startTime && s.endTime) {
      const [sh, sm] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      const start = sh * 60 + sm;
      const end = eh * 60 + em;
      if (start >= end) {
        ctx.addIssue({
          code: "custom",
          path: ["schedules", idx, "endTime"],
          message: "End time must be after start time",
        });
      }
    }
  });
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
