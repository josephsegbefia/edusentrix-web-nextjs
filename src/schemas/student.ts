import { z } from "zod";

export const CreateStudentSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required"),
    middleName: z.string().trim().optional(),
    lastName: z.string().trim().min(1, "Last name is required"),
    gradeId: z.string().trim().min(1, "Grade is required"),
    classGroupId: z.string().min(1, "Class group is required"),
    admissionNo: z.string().trim().optional(),

    sex: z.enum(["male", "female"]).optional(),
    dateOfBirth: z.date().optional(), // ISO "YYYY-MM-DD"
    photoUrl: z.url().optional(), // Cloudinary URL
    status: z.enum(["active", "inactive", "withdrawn", "graduated"]),
    enrolledAt: z.string().optional(), // ISO "YYYY-MM-DD"

    subjectAddIds: z.array(z.string().trim()),
    subjectRemoveIds: z.array(z.string().trim()),

    // GES (Ghana Education Service) — optional, can be attached later
    gesIndexNumber: z.string().trim().optional(),
    gesSchoolCode: z.string().trim().optional(),
  })
  .refine(
    (v) => {
      if (!v.dateOfBirth || !v.enrolledAt) return true;
      const dob = new Date(v.dateOfBirth);
      const enr = new Date(v.enrolledAt);
      return dob < enr;
    },
    {
      path: ["dateOfBirth"],
      message: "Date of birth must be before enrolment date",
    }
  )
  .refine(
    (v) => {
      const adds = new Set(v.subjectAddIds ?? []);
      const rems = new Set(v.subjectRemoveIds ?? []);
      for (const id of adds) if (rems.has(id)) return false;
      return true;
    },
    {
      path: ["subjectRemoveIds"],
      message: "A subject cannot be both added and excluded",
    }
  );

export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;

/** Partial update for PATCH /api/admin/students/:id (admin profile edit). */
export const PatchStudentProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).optional(),
    middleName: z.string().trim().nullable().optional(),
    lastName: z.string().trim().min(1).optional(),
    admissionNo: z.string().trim().nullable().optional(),
    sex: z.enum(["male", "female"]).nullable().optional(),
    dateOfBirth: z.string().nullable().optional(),
    /** PATCH accepts any non-empty string (stored URLs may be relative or legacy formats). */
    photoUrl: z.string().nullable().optional(),
    status: z.enum(["active", "inactive", "withdrawn", "graduated"]).optional(),
    enrolledAt: z.string().nullable().optional(),
    gradeId: z.string().trim().optional(),
    classGroupId: z.string().trim().optional(),
    gesIndexNumber: z.string().trim().nullable().optional(),
    gesSchoolCode: z.string().trim().nullable().optional(),
  })
  .strict()
  .refine(
    (v) => Object.values(v).some((x) => x !== undefined),
    { message: "At least one field is required" }
  )
  .refine(
    (v) => {
      const g = v.gradeId?.trim() ?? "";
      const c = v.classGroupId?.trim() ?? "";
      const hasG = g.length > 0;
      const hasC = c.length > 0;
      if (hasG !== hasC) return false;
      return true;
    },
    { message: "Grade and class must be updated together", path: ["classGroupId"] }
  )
  .refine(
    (v) => {
      if (!v.dateOfBirth || !v.enrolledAt) return true;
      const dob = new Date(v.dateOfBirth);
      const enr = new Date(v.enrolledAt);
      return dob < enr;
    },
    {
      path: ["dateOfBirth"],
      message: "Date of birth must be before enrolment date",
    }
  );

export type PatchStudentProfileInput = z.infer<typeof PatchStudentProfileSchema>;

/** Grade + class only (assign / change class). */
export const AssignStudentClassSchema = z.object({
  gradeId: z.string().trim().min(1, "Select a grade"),
  classGroupId: z.string().trim().min(1, "Select a class"),
});

export type AssignStudentClassInput = z.infer<typeof AssignStudentClassSchema>;
