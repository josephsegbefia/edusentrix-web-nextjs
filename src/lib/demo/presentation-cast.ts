import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";

export const PRESENTATION_SEED_MARKER = "presentation-demo-v1";

export const PRESENTATION_SCHOOL_NAME = "Lighthouse Preparatory School";

export const PRESENTATION_ADMIN = {
  role: "school_admin" as const,
  firstName: "Ama",
  lastName: "Boateng",
  title: "Mrs. Ama Boateng",
  emailLocal: "ama.boateng",
  fallbackEmails: ["admin@lighthouseprep.demo.tryedusentrix.app"],
};

export const PRESENTATION_TEACHER = {
  role: "teacher" as const,
  firstName: "Daniel",
  lastName: "Owusu",
  title: "Mr. Daniel Owusu",
  subject: "Mathematics",
  emailLocal: "daniel.owusu",
};

export const PRESENTATION_PARENT = {
  role: "parent" as const,
  firstName: "Akosua",
  lastName: "Mensah",
  title: "Akosua Mensah",
  relationship: "mother" as const,
  emailLocal: "akosua.mensah",
  phone: "024 555 0182",
};

export const PRESENTATION_STUDENT = {
  role: "student" as const,
  firstName: "Kwame",
  lastName: "Mensah",
  title: "Kwame Mensah",
  className: "A",
  gradeName: "JHS 2",
  emailLocal: "kwame.mensah",
  admissionNo: "PRES-S0001",
  sex: "male" as const,
};

export const PRESENTATION_SUBJECTS = [
  "Mathematics",
  "English Language",
  "Integrated Science",
  "Social Studies",
  "Computing",
  "Religious and Moral Education",
] as const;

export const PRESENTATION_OUTSTANDING_CEDIS = 850;

export type PresentationPersonaRole = "school_admin" | "teacher" | "parent";

const PERSONA_LOOKUP: Record<
  PresentationPersonaRole,
  { firstName: string; lastName: string; emailLocal: string; fallbackEmails?: string[] }
> = {
  school_admin: PRESENTATION_ADMIN,
  teacher: PRESENTATION_TEACHER,
  parent: PRESENTATION_PARENT,
};

export function presentationPersonaEmail(
  emailLocal: string,
  schoolId: string
): string {
  return `${emailLocal}.${schoolId}@lighthouseprep.demo.tryedusentrix.app`.toLowerCase();
}

export async function findPresentationPersonaUser(
  schoolId: unknown,
  role: PresentationPersonaRole
) {
  const spec = PERSONA_LOOKUP[role];
  const schoolIdStr = String(schoolId);

  const emails = [
    presentationPersonaEmail(spec.emailLocal, schoolIdStr),
    ...(spec.fallbackEmails ?? []),
  ];
  const byEmail = await User.findOne({
    schoolId,
    email: { $in: emails },
  })
    .select("_id role email")
    .lean();
  if (byEmail) return byEmail;

  const named = await User.findOne({
    schoolId,
    role,
    firstName: spec.firstName,
    lastName: spec.lastName,
  })
    .select("_id role email")
    .lean();
  if (named) return named;

  const membership = await UserMembership.findOne({
    schoolId,
    status: "active",
    roles: role,
  })
    .select("userId roles")
    .lean();

  if (membership?.userId) {
    const user = await User.findById(membership.userId)
      .select("_id role email")
      .lean();
    if (user) return user;
  }

  return User.findOne({
    schoolId,
    role,
  })
    .select("_id role email")
    .lean();
}
