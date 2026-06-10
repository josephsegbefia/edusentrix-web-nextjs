"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Camera, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { useUploadThing } from "@/lib/uploadthing/react";
import {
  getUploadThingErrorMessage,
  logUploadThingClientError,
} from "@/lib/uploadthing/client-errors";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_SIZE_MB = 5;

type TeacherDetailAvatarProps = {
  teacherId: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  photoUrl: string | null;
};

function initialsFromName(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0)?.toUpperCase() || "";
  const last = lastName?.charAt(0)?.toUpperCase() || "";
  return first + last || "?";
}

function isAcceptedImage(file: File) {
  return ACCEPT.some(
    (type) => file.type === type || file.type.startsWith(type.replace("/*", "/"))
  );
}

export function TeacherDetailAvatar({
  teacherId,
  schoolId,
  firstName,
  lastName,
  fullName,
  photoUrl,
}: TeacherDetailAvatarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const uploadErrorMessage = React.useRef<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(photoUrl);
  const [localPreview, setLocalPreview] = React.useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  React.useEffect(() => {
    setPreviewUrl(photoUrl);
  }, [photoUrl]);

  const { startUpload } = useUploadThing("teacherAvatar", {
    onUploadError: (error) => {
      logUploadThingClientError("teacherAvatar onUploadError", error);
      uploadErrorMessage.current = getUploadThingErrorMessage(error);
    },
  });

  async function persistPhotoUrl(url: string, publicId: string) {
    const res = await fetch(`/api/admin/teachers/${teacherId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photoUrl: url,
        avatarPublicId: publicId || null,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(
        (json && typeof json === "object" && "error" in json && json.error
          ? String(json.error)
          : null) || "Failed to save teacher photo"
      );
    }
    await queryClient.invalidateQueries({
      queryKey: ["teachers", "detail", teacherId],
    });
    await queryClient.invalidateQueries({ queryKey: ["teachers"] });
    setPreviewUrl(url);
    setLocalPreview(null);
  }

  async function handleFile(file: File) {
    if (busy) return;

    if (!isAcceptedImage(file)) {
      toast.error("Unsupported image type", {
        description: "Use JPG, PNG, or WEBP.",
      });
      return;
    }

    const maxBytes = MAX_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error("Image too large", {
        description: `Maximum size is ${MAX_SIZE_MB} MB.`,
      });
      return;
    }

    try {
      setBusy(true);
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
        uploaded.serverData?.url || uploaded.ufsUrl || uploaded.url || "";
      const key = uploaded.serverData?.key || uploaded.key || "";
      if (!url.trim()) {
        throw new Error("Upload did not return a usable image URL");
      }

      await persistPhotoUrl(url.trim(), key);
      toast.success("Photo updated", {
        description: "The teacher profile photo has been saved.",
      });
    } catch (error: unknown) {
      setLocalPreview(null);
      const message =
        error instanceof Error ? error.message : "Could not update photo";
      toast.error("Photo update failed", { description: message });
    } finally {
      setBusy(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function openPicker() {
    if (!busy) inputRef.current?.click();
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
  }

  function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    if (busy) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  const displayUrl = localPreview || previewUrl;

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={openPicker}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        disabled={busy}
        aria-label={displayUrl ? "Replace teacher photo" : "Upload teacher photo"}
        title={displayUrl ? "Click or drop to replace photo" : "Click or drop to upload photo"}
        className={cn(
          "group relative rounded-2xl outline-none transition-all focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
          busy ? "cursor-wait" : "cursor-pointer",
          dragOver && "ring-2 ring-indigo-400/50 ring-offset-2 ring-offset-slate-950"
        )}
      >
        <Avatar className="h-20 w-20 shrink-0 rounded-2xl border border-white/15 shadow-lg transition-all group-hover:border-indigo-400/40">
          {displayUrl ? (
            <AvatarImage src={displayUrl} alt={fullName} className="object-cover" />
          ) : null}
          <AvatarFallback className="rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-600/30 text-xl font-semibold text-white">
            {initialsFromName(firstName, lastName)}
          </AvatarFallback>
        </Avatar>

        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl bg-black/55 text-white transition-opacity",
            busy || dragOver ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          ) : (
            <>
              <Camera className="h-5 w-5" aria-hidden />
              <span className="px-2 text-center text-[9px] font-medium leading-tight text-white/90">
                {displayUrl ? "Replace" : "Upload"}
              </span>
            </>
          )}
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="hidden"
        onChange={handleInputChange}
        disabled={busy}
      />
    </div>
  );
}
