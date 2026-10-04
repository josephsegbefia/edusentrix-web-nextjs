"use client";

import { useCallback } from "react";
import { uploadFileToStorage } from "@/lib/storage/client/upload";
import type { StorageKind } from "@/lib/storage/types";

type SubjectRole =
  | "students"
  | "teachers"
  | "school_admins"
  | "parents"
  | "staff"
  | "bursars";

type UseUploadFileOptions = {
  schoolId: string;
  subjectRole: SubjectRole;
};

type UploadResult = {
  url: string;
  publicId: string;
};

function kindForRole(subjectRole: SubjectRole): StorageKind {
  switch (subjectRole) {
    case "students":
      return "student_avatar";
    case "teachers":
      return "teacher_avatar";
    case "parents":
      return "parent_avatar";
    case "school_admins":
      return "school_admin_avatar";
    case "staff":
      return "staff_avatar";
    case "bursars":
      return "bursar_avatar";
    default:
      return "teacher_avatar";
  }
}

export function useUploadFile({
  schoolId: _schoolId,
  subjectRole,
}: UseUploadFileOptions) {
  const upload = useCallback(
    async (file: File): Promise<UploadResult> => {
      const uploaded = await uploadFileToStorage({
        kind: kindForRole(subjectRole),
        file,
      });
      return { url: uploaded.assetUrl, publicId: uploaded.assetId };
    },
    [subjectRole]
  );

  return { upload };
}
