export type MembershipUploadAccessResult =
  | { allowed: true; effectiveSchoolId: string }
  | { allowed: false; reason: string };

export function isProfileMediaUploadFolder(folder: string) {
  return folder.includes("/avatars") || folder.startsWith("school/branding");
}

export function resolveMembershipSchoolUploadAccess(input: {
  requestedSchoolId?: string | null;
  activeSchoolId?: string | null;
  membershipSchoolIds?: string[];
}): MembershipUploadAccessResult {
  const requestedSchoolId = input.requestedSchoolId?.trim() || null;
  const activeSchoolId = input.activeSchoolId?.trim() || null;
  const membershipSchoolIds = new Set(
    (input.membershipSchoolIds ?? []).map((id) => id.trim()).filter(Boolean)
  );
  if (activeSchoolId) membershipSchoolIds.add(activeSchoolId);

  const targetSchoolId = requestedSchoolId ?? activeSchoolId;
  if (!targetSchoolId) {
    return { allowed: false, reason: "No school associated with user" };
  }

  if (membershipSchoolIds.has(targetSchoolId)) {
    return { allowed: true, effectiveSchoolId: targetSchoolId };
  }

  return { allowed: false, reason: "Forbidden school upload target" };
}
