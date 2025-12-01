import { z } from "zod";

export const CreateTeacherSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().trim().optional(),
  photoUrl: z.string().url().optional(),
  subjectIds: z.array(z.string().trim()).default([]),
  homeroomClassGroupId: z.string().trim().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export type CreateTeacherInput = z.infer<typeof CreateTeacherSchema>;
