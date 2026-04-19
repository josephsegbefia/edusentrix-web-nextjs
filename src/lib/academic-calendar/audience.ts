import { DEFAULT_AUDIENCE_ROLES, type CalendarAudience } from "@/lib/academic-calendar/types";

export function normalizeAudience(input?: CalendarAudience | null): CalendarAudience {
  return {
    scope: input?.scope || "school",
    gradeIds: input?.gradeIds || [],
    classGroupIds: input?.classGroupIds || [],
    userIds: input?.userIds || [],
    roles: input?.roles && input.roles.length > 0 ? input.roles : [...DEFAULT_AUDIENCE_ROLES],
  };
}

export function audienceIncludesRole(audience: CalendarAudience, role: string) {
  if (!audience.roles || audience.roles.length === 0) return true;
  return audience.roles.includes(role as any);
}

export function matchesAudienceScope(input: {
  audience: CalendarAudience;
  gradeIds: string[];
  classGroupIds: string[];
  userId?: string | null;
}) {
  const { audience, gradeIds, classGroupIds, userId } = input;

  if (audience.scope === "school") return true;
  if (audience.scope === "grades") {
    return audience.gradeIds?.some((id) => gradeIds.includes(id)) ?? false;
  }
  if (audience.scope === "classes") {
    return audience.classGroupIds?.some((id) => classGroupIds.includes(id)) ?? false;
  }
  if (audience.scope === "specific_users") {
    if (!userId) return false;
    return audience.userIds?.includes(userId) ?? false;
  }
  return false;
}
