"use client";

import * as React from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentUploader } from "@/components/upload/DocumentUploader";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";
import { useAuth } from "@/providers/auth-provider";

const uploadSchema = z.object({
  name: z.string().min(1, "Document name is required").max(200),
  type: z.enum([
    "report_card",
    "medical",
    "consent",
    "identification",
    "disciplinary",
    "other",
  ]),
  notes: z.string().max(2000).optional().nullable(),
});

type FormValues = z.infer<typeof uploadSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
};

const DOC_TYPES: { value: FormValues["type"]; label: string }[] = [
  { value: "report_card", label: "Report card / transcript" },
  { value: "medical", label: "Medical" },
  { value: "consent", label: "Consent / permission" },
  { value: "identification", label: "Identification" },
  { value: "disciplinary", label: "Disciplinary" },
  { value: "other", label: "Other" },
];

export function UploadStudentDocumentModal({
  open,
  onOpenChange,
  studentId,
  studentName,
}: Props) {
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const [uploadedFile, setUploadedFile] = React.useState<{
    url: string;
    publicId: string;
    bytes: number;
    mimeType?: string;
  } | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      name: "",
      type: "other",
      notes: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({ name: "", type: "other", notes: "" });
      setUploadedFile(null);
    }
  }, [open, reset]);

  const handleFileUploaded = (payload: {
    publicId: string;
    url: string;
    bytes: number;
    format?: string;
    mimeType?: string;
  }) => {
    setUploadedFile(payload);
    const currentName = watch("name");
    if (!currentName && payload.publicId) {
      const parts = payload.publicId.split("/");
      const filename = parts[parts.length - 1] || "document";
      setValue("name", filename);
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (!uploadedFile) {
      toast.error("Please upload a file first");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/students/${studentId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          type: data.type,
          fileUrl: uploadedFile.url,
          fileMime: uploadedFile.mimeType ?? null,
          fileSize: uploadedFile.bytes,
          notes: data.notes?.trim() || null,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          typeof json?.error === "string"
            ? json.error
            : "Failed to save document";
        throw new Error(msg);
      }

      toast.success("Document uploaded");
      await queryClient.invalidateQueries({
        queryKey: ["admin-student-detail", studentId],
      });
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const isPending = submitting || isSubmitting;

  React.useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onOpenChange(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isPending, onOpenChange]);

  if (!open) return null;

  if (!me?.schoolId) {
    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) onOpenChange(false);
            }}
          />
          <div className="relative z-10 flex min-h-full items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 text-white shadow-2xl shadow-black/40"
            >
              <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
                <h2 className="text-lg font-semibold">Upload document</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-white/70 hover:bg-white/10"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="px-6 py-5 text-sm text-white/70">
                School context is missing. Refresh and try again.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-modal="true"
        role="dialog"
      >
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isPending) onOpenChange(false);
          }}
        />

        <div className="relative z-10 flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 text-white shadow-2xl shadow-black/40"
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold">Upload document</h2>
                <p className="mt-1 text-sm text-white/60">
                  For{" "}
                  <span className="font-medium text-white/85">{studentName}</span>
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isPending}
                className="h-9 w-9 shrink-0 rounded-full text-white/70 hover:bg-white/10"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="max-h-[min(70vh,640px)] space-y-5 overflow-y-auto px-6 py-5"
            >
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-white/50">
                  File
                </Label>
                <DocumentUploader
                  schoolId={me.schoolId}
                  category="student-records"
                  maxSizeMB={15}
                  onUploaded={handleFileUploaded}
                  onError={(msg) => toast.error(msg)}
                  label={
                    uploadedFile ? "File ready — choose another to replace" : "Drop file or click to upload"
                  }
                />
                {uploadedFile ? (
                  <p className="text-xs text-white/50">
                    {(uploadedFile.bytes / 1024 / 1024).toFixed(2)} MB
                  </p>
                ) : (
                  <p className="text-xs text-white/45">
                    PDF, Office, images, CSV, or video (see uploader limits)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="student-doc-name"
                  className="text-xs font-medium uppercase tracking-wider text-white/50"
                >
                  Display name
                </Label>
                <Input
                  id="student-doc-name"
                  {...register("name")}
                  placeholder="e.g. Term 1 report 2026"
                  className="border-white/15 bg-white/5 text-white placeholder:text-white/35"
                />
                {errors.name ? (
                  <p className="text-xs text-red-400">{errors.name.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wider text-white/50">
                  Category
                </Label>
                <Select
                  value={watch("type")}
                  onValueChange={(v) =>
                    setValue("type", v as FormValues["type"], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="border-white/15 bg-white/5 text-white">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className={premiumSelectContent}>
                    {DOC_TYPES.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className={premiumMenuItem}
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.type ? (
                  <p className="text-xs text-red-400">{errors.type.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="student-doc-notes"
                  className="text-xs font-medium uppercase tracking-wider text-white/50"
                >
                  Notes (optional)
                </Label>
                <Textarea
                  id="student-doc-notes"
                  {...register("notes")}
                  rows={3}
                  placeholder="Internal note for staff…"
                  className="resize-none border-white/15 bg-white/5 text-white placeholder:text-white/35"
                />
                {errors.notes ? (
                  <p className="text-xs text-red-400">{errors.notes.message}</p>
                ) : null}
              </div>

              <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/20 bg-transparent text-white hover:bg-white/10"
                  disabled={isPending}
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending || !uploadedFile}
                  className="bg-violet-600 text-white hover:bg-violet-500"
                >
                  {isPending ? "Saving…" : "Save document"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
