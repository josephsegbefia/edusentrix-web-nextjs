"use client";

import { useCallback } from "react";
import { uploadFiles } from "@/lib/uploadthing/react";

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

function endpointForRole(subjectRole: SubjectRole) {
  switch (subjectRole) {
    case "students":
      return "studentAvatar" as const;
    case "teachers":
      return "teacherAvatar" as const;
    case "parents":
      return "parentAvatar" as const;
    case "school_admins":
      return "schoolAdminAvatar" as const;
    case "staff":
      return "staffAvatar" as const;
    case "bursars":
      return "bursarAvatar" as const;
    default:
      return "teacherAvatar" as const;
  }
}

export function useUploadFile({
  schoolId: _schoolId,
  subjectRole,
}: UseUploadFileOptions) {
  const upload = useCallback(
    async (file: File): Promise<UploadResult> => {
      const endpoint = endpointForRole(subjectRole);
      const result = await uploadFiles(endpoint, {
        files: [file],
        input: { schoolId: _schoolId },
      });
      const uploaded = result?.[0];

      if (!uploaded) {
        throw new Error("Upload did not return a file");
      }

      const url = uploaded.serverData?.url || uploaded.ufsUrl || uploaded.url;
      const publicId = uploaded.serverData?.key || uploaded.key;

      return { url, publicId };
    },
    [_schoolId, subjectRole]
  );

  return { upload };
}
