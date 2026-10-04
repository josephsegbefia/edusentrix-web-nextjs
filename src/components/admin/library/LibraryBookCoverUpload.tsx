"use client";

import * as React from "react";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { useToast } from "@/hooks/useToast";
import { uploadFileToStorage } from "@/lib/storage/client/upload";

type LibraryBookCoverUploadProps = {
  schoolId: string;
  maxSizeMB?: number;
  previewUrl: string | null;
  onUploaded: (payload: { url: string; key: string }) => void;
  onError?: (msg: string) => void;
  className?: string;
  label?: string;
  /** When true, uploads are blocked (e.g. delegate without update permission). */
  readOnly?: boolean;
};

export function LibraryBookCoverUpload({
  schoolId,
  maxSizeMB = 8,
  previewUrl,
  onUploaded,
  onError,
  className,
  label = "Cover image",
  readOnly = false,
}: LibraryBookCoverUploadProps) {
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(previewUrl);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [localPreview, setLocalPreview] = React.useState<string | null>(null);
  const toast = useToast();

  React.useEffect(() => {
    setPreview(previewUrl);
  }, [previewUrl]);

  async function handleUpload(file: File) {
    if (readOnly) return;
    try {
      setBusy(true);
      setUploadProgress(0);

      const reader = new FileReader();
      reader.onloadend = () => setLocalPreview(reader.result as string);
      reader.readAsDataURL(file);

      const uploaded = await uploadFileToStorage({
        kind: "library_book_cover",
        file,
        onProgress: setUploadProgress,
      });

      setUploadProgress(100);
      setPreview(uploaded.assetUrl);
      setLocalPreview(null);
      setTimeout(() => setUploadProgress(null), 400);

      onUploaded({ url: uploaded.assetUrl, key: uploaded.assetId });
      toast.success("Cover uploaded", {
        description: "The image is attached to this catalogue record.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Upload error";
      setLocalPreview(null);
      setUploadProgress(null);
      toast.error("Upload failed", { description: message });
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
        disabled={readOnly || busy}
        hint="JPG, PNG, WEBP — school admins only"
        previewImage={displayPreview}
        uploadProgress={uploadProgress}
        showProgress={busy && uploadProgress !== null}
      />
    </div>
  );
}
