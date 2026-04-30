import mongoose from "mongoose";
import { mergedDelegationPermissions } from "@/lib/delegations/service";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";

const LIBRARY_COVER_UPLOAD_PERMS = [
  LIBRARY_PERMISSIONS.BOOKS_CREATE,
  LIBRARY_PERMISSIONS.BOOKS_UPDATE,
] as const;

/**
 * School/platform admins, or delegated users with book write, may upload covers.
 */
export async function canUploadLibraryBookCover(params: {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role?: string | null;
}): Promise<boolean> {
  if (params.role === "school_admin" || params.role === "platform_admin") {
    return true;
  }
  const perms = await mergedDelegationPermissions(params.schoolId, params.userId);
  return LIBRARY_COVER_UPLOAD_PERMS.some((p) => perms.includes(p));
}
