"use client";

import React, { useMemo, useRef, useState } from "react";
import { FileDropzone } from "./FileDropzone";
import { useToast } from "@/hooks/useToast";
import { useUploadThing } from "@/lib/uploadthing/react";

type SubjectRole =
  | "students"
  | "teachers"
  | "school_admins"
  | "parents"
  | "staff"
  | "bursars";

type ImageUploaderProps = {
  schoolId: string;
  /** target subject role (where to store) — NOT the uploader's role */
  subjectRole: SubjectRole;
  maxSizeMB?: number; // default 5
  onUploaded: (payload: {
    publicId: string;
    url: string;
    bytes: number;
    width?: number;
    height?: number;
    format?: string;
  }) => void;
  onError?: (msg: string) => void;
  className?: string;
  label?: string;
};

type AvatarEndpoint =
  | "studentAvatar"
  | "teacherAvatar"
  | "parentAvatar"
  | "schoolAdminAvatar"
  | "staffAvatar"
  | "bursarAvatar";

function endpointForRole(subjectRole: SubjectRole): AvatarEndpoint {
  switch (subjectRole) {
    case "students":
      return "studentAvatar";
    case "teachers":
      return "teacherAvatar";
    case "parents":
      return "parentAvatar";
    case "school_admins":
      return "schoolAdminAvatar";
    case "staff":
      return "staffAvatar";
    case "bursars":
      return "bursarAvatar";
    default:
      return "teacherAvatar";
  }
}

function inferFormat(name: string, type?: string): string | undefined {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext) {
    return ext;
  }
  if (type && type.includes("/")) {
    return type.split("/").pop();
  }
  return undefined;
}

export function ImageUploader({
  schoolId: _schoolId,
  subjectRole,
  maxSizeMB = 5,
  onUploaded,
  onError,
  className,
  label = "Upload avatar",
}: ImageUploaderProps) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const uploadErrorMessage = useRef<string | null>(null);
  const toast = useToast();

  const endpoint = useMemo(() => endpointForRole(subjectRole), [subjectRole]);

  const { startUpload } = useUploadThing(endpoint, {
    onUploadProgress: (progress) => {
      setUploadProgress(Math.min(95, progress));
    },
    onUploadError: (error) => {
      uploadErrorMessage.current = error.message || "Upload failed";
    },
  });

  async function handleUpload(file: File) {
    try {
      setBusy(true);
      setUploadProgress(0);
      uploadErrorMessage.current = null;

      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      const result = await startUpload([file], { schoolId: _schoolId } as never);
      const uploaded = result?.[0];

      if (!uploaded) {
        throw new Error(uploadErrorMessage.current || "Upload did not return a file");
      }

      const url = uploaded.serverData?.url || uploaded.ufsUrl || uploaded.url;
      const key = uploaded.serverData?.key || uploaded.key;
      const bytes = uploaded.size ?? file.size;
      const format = inferFormat(uploaded.name || file.name, uploaded.type || file.type);

      setUploadProgress(100);
      setPreview(url);
      setLocalPreview(null);

      setTimeout(() => {
        setUploadProgress(null);
      }, 500);

      onUploaded({
        publicId: key,
        url,
        bytes,
        format,
      });

      toast.success("Image uploaded successfully", {
        description: "Your image is ready to use.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Upload error";
      setLocalPreview(null);
      setUploadProgress(null);
      toast.error("Upload failed", {
        description: message,
      });
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  const displayPreview = preview || localPreview;

  return (
    <div className={className}>
      <FileDropzone
        label={label}
        accept={["image/jpeg", "image/png", "image/webp"]}
        maxSizeMB={maxSizeMB}
        onFile={handleUpload}
        disabled={busy}
        hint="JPG, PNG, WEBP"
        previewImage={displayPreview}
        uploadProgress={uploadProgress}
        showProgress={busy && uploadProgress !== null}
      />
    </div>
  );
}
