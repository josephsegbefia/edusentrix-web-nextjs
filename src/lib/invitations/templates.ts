import type { InvitationRole } from "@/lib/roles";

export type InvitationTrackedTemplateKey =
  | "TEACHER_INVITE"
  | "PARENT_INVITE"
  | "BURSAR_INVITE"
  | "BILLING_OWNER_INVITE"
  | "SCHOOL_ADMIN_INVITE"
  | "USER_INVITE";

const ROLE_TEMPLATE_MAP: Record<InvitationRole, InvitationTrackedTemplateKey> = {
  teacher: "TEACHER_INVITE",
  parent: "PARENT_INVITE",
  bursar: "BURSAR_INVITE",
  billing_owner: "BILLING_OWNER_INVITE",
  school_admin: "SCHOOL_ADMIN_INVITE",
  staff: "USER_INVITE",
};

export function invitationTemplateKeyForRole(
  role: InvitationRole
): InvitationTrackedTemplateKey {
  const key = ROLE_TEMPLATE_MAP[role];
  if (!key) {
    throw new Error(`Unsupported invitation role: ${String(role)}`);
  }
  return key;
}

export function invitationDisplayRole(
  role: InvitationRole,
  metadata?: Record<string, unknown> | null
): string {
  if (role === "billing_owner") return "billing owner";
  if (
    role === "bursar" &&
    metadata?.accessSurface === "payment_setup_delegate"
  ) {
    return "finance delegate";
  }
  if (role === "school_admin") return "school admin";
  return role;
}
