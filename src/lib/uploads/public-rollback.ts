import { Types } from "mongoose";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { Student } from "@/models/Student";
import type { StorageKind } from "@/lib/storage/types";
import { parseStoredAssetId } from "@/lib/storage/urls";
import { deleteUploadedFile } from "./delete";

export type PublicRollbackScope = {
  schoolId: Types.ObjectId | string;
  kind: Extract<StorageKind, "admission_document" | "parent_document">;
};

/**
 * Rolls back a file a public token route was about to attach. Call it only
 * once the token has resolved to a school. It deletes nothing unless the
 * asset is an anonymous, unlinked upload of the token's kind in that school
 * that no application or student record references yet, so a caller cannot
 * use a valid token to remove someone else's submitted document.
 */
export async function rollbackPublicUpload(
  url: string,
  scope: PublicRollbackScope
): Promise<boolean> {
  const assetId = parseStoredAssetId(url);
  if (!assetId) return false;
  const schoolId = new Types.ObjectId(String(scope.schoolId));
  const reference = new RegExp(`/api/storage/assets/${assetId}(\\?.*)?$`, "i");
  const [inApplication, inStudent] = await Promise.all([
    AdmissionApplication.exists({ schoolId, "documents.fileUrl": reference }),
    Student.exists({
      schoolId,
      $or: [
        { "recordDocuments.fileUrl": reference },
        { "enrollmentDocuments.fileUrl": reference },
      ],
    }),
  ]);
  if (inApplication || inStudent) return false;
  return deleteUploadedFile(url, {
    schoolId,
    kinds: [scope.kind],
    publicUploadsOnly: true,
  });
}

export async function rollbackPublicUploads(
  urls: string[],
  scope: PublicRollbackScope
): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;
  for (const url of urls) {
    if (await rollbackPublicUpload(url, scope)) {
      deleted += 1;
    } else {
      failed += 1;
    }
  }
  return { deleted, failed };
}
