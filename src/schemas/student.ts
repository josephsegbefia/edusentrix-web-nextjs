import { z } from "zod";

export const createStudentSchema = z
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
    status: z.enum(["active", "inactive", "withdrawn"]).default("active"),
    enrolledAt: z.string().optional(), // ISO "YYYY-MM-DD"

    subjectAddIds: z.array(z.string().trim()).optional().default([]),
    subjectRemoveIds: z.array(z.string().trim()).optional().default([]),
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

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
