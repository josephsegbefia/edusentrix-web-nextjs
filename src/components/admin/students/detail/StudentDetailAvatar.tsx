"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Camera, Loader2, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { uploadFileToStorage } from "@/lib/storage/client/upload";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_SIZE_MB = 5;

type StudentDetailAvatarProps = {
  studentId: string;
  schoolId: string;
  fullName: string;
  photoUrl: string | null;
  status: string;
};

function initialsFromName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0]!.charAt(0)?.toUpperCase() ?? "";
  return (
    (parts[0]?.charAt(0)?.toUpperCase() ?? "") +
    (parts[parts.length - 1]?.charAt(0)?.toUpperCase() ?? "")
  );
}

function isAcceptedImage(file: File) {
  return ACCEPT.some(
    (type) => file.type === type || file.type.startsWith(type.replace("/*", "/"))
  );
}

export function StudentDetailAvatar({
  studentId,
  schoolId: _schoolId,
  fullName,
  photoUrl,
  status,
}: StudentDetailAvatarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(photoUrl);
  const [localPreview, setLocalPreview] = React.useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  React.useEffect(() => {
    setPreviewUrl(photoUrl);
  }, [photoUrl]);

  async function persistPhotoUrl(url: string) {
    const res = await fetch(`/api/admin/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoUrl: url }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(
        (json && typeof json === "object" && "error" in json && json.error
          ? String(json.error)
          : null) || "Failed to save student photo"
      );
    }
    await queryClient.invalidateQueries({
      queryKey: ["admin-student-detail", studentId],
    });
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

      const reader = new FileReader();
      reader.onloadend = () => setLocalPreview(reader.result as string);
      reader.readAsDataURL(file);

      const uploaded = await uploadFileToStorage({
        kind: "student_avatar",
        file,
        association: { type: "student", id: studentId },
      });

      await persistPhotoUrl(uploaded.assetUrl);
      toast.success("Photo updated", {
        description: "The student profile photo has been saved.",
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
        aria-label={displayUrl ? "Replace student photo" : "Upload student photo"}
        title={displayUrl ? "Click or drop to replace photo" : "Click or drop to upload photo"}
        className={cn(
          "group relative rounded-full outline-none transition-all focus-visible:ring-2 focus-visible:ring-teal-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
          busy ? "cursor-wait" : "cursor-pointer",
          dragOver && "ring-2 ring-teal-400/50 ring-offset-2 ring-offset-slate-950"
        )}
      >
        <Avatar className="size-24 rounded-full border-2 border-(--ws-line-strong) shadow-xl shadow-black/50 ring-2 ring-teal-500/20 transition-all group-hover:border-teal-400/40 group-hover:ring-teal-400/30">
          {displayUrl ? (
            <AvatarImage src={displayUrl} alt={fullName} className="object-cover" />
          ) : null}
          <AvatarFallback className="bg-linear-to-br from-teal-600/40 to-cyan-600/40 text-2xl font-bold text-(--ws-fg)">
            {initialsFromName(fullName)}
          </AvatarFallback>
        </Avatar>

        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-(--ws-fill)5 text-(--ws-fg) transition-opacity",
            busy || dragOver ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          ) : (
            <>
              <Camera className="h-5 w-5" aria-hidden />
              <span className="px-2 text-center text-[9px] font-medium leading-tight text-(--ws-fg-90)">
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

      {status === "active" && (
        <div className="pointer-events-none absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-900 bg-emerald-500 shadow-lg shadow-emerald-500/30">
          <Sparkles className="h-3 w-3 text-(--ws-fg)" />
        </div>
      )}
    </div>
  );
}
