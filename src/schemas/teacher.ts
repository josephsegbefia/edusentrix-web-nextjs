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
