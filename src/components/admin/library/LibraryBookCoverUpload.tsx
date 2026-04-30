"use client";

import * as React from "react";
import { FileDropzone } from "@/components/upload/FileDropzone";
import { useToast } from "@/hooks/useToast";
import { useUploadThing } from "@/lib/uploadthing/react";

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
  const uploadErrorMessage = React.useRef<string | null>(null);
  const toast = useToast();

  React.useEffect(() => {
    setPreview(previewUrl);
  }, [previewUrl]);

  const { startUpload } = useUploadThing("libraryBookCover", {
    onUploadProgress: (progress) => setUploadProgress(Math.min(95, progress)),
    onUploadError: (error) => {
      uploadErrorMessage.current = error.message || "Upload failed";
    },
  });

  async function handleUpload(file: File) {
    if (readOnly) return;
    try {
      setBusy(true);
      setUploadProgress(0);
      uploadErrorMessage.current = null;

      const reader = new FileReader();
      reader.onloadend = () => setLocalPreview(reader.result as string);
      reader.readAsDataURL(file);

      const result = await startUpload([file], { schoolId });
      const uploaded = result?.[0];
      if (!uploaded) {
        throw new Error(uploadErrorMessage.current || "Upload did not return a file");
      }

      const url =
        (uploaded as { serverData?: { url?: string } }).serverData?.url ||
        (uploaded as { ufsUrl?: string }).ufsUrl ||
        (uploaded as { url?: string }).url ||
        "";
      const internalFile = uploaded as { serverData?: { key?: string }; key?: string };
      const key = internalFile.serverData?.key ?? internalFile.key ?? "";
      if (!url || !key) {
        throw new Error("Upload response missing url or key");
      }

      setUploadProgress(100);
      setPreview(url);
      setLocalPreview(null);
      setTimeout(() => setUploadProgress(null), 400);

      onUploaded({ url, key });
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
