// src/components/modals/UploadDocumentModal.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
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
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { DocumentUploader } from "@/components/upload/DocumentUploader";
import {
  useUploadDocument,
  type UploadDocumentInput,
  type TeacherDocumentType,
} from "@/hooks/admin/useTeacherDocuments";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";
import { useAuth } from "@/providers/auth-provider";

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value?: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const UploadDocumentSchema = z.object({
  name: z.string().min(1, "Document name is required").max(200),
  type: z.enum(["contract", "certificate", "license", "id", "resume", "other"]),
  category: z.string().max(100).optional().nullable(),
  tags: z.string().optional().nullable(), // Comma-separated tags
  notes: z.string().max(1000).optional().nullable(),
  issueDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
}).refine((data) => {
  // If expiryDate is provided, it should be after issueDate (if provided)
  if (data.expiryDate && data.issueDate) {
    return new Date(data.expiryDate) >= new Date(data.issueDate);
  }
  return true;
}, {
  message: "Expiry date must be after issue date",
  path: ["expiryDate"],
});

type DocumentFormValues = z.infer<typeof UploadDocumentSchema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  teacherName: string;
};

export function UploadDocumentModal({
  open,
  onOpenChange,
  teacherId,
  teacherName,
}: Props) {
  const { me } = useAuth();
  const [uploadedFile, setUploadedFile] = React.useState<{
    url: string;
    publicId: string;
    bytes: number;
    format?: string;
    mimeType?: string;
  } | null>(null);

  const uploadDocumentMutation = useUploadDocument();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DocumentFormValues>({
    resolver: zodResolver(UploadDocumentSchema),
    defaultValues: {
      name: "",
      type: "other",
      category: undefined,
      tags: "",
      notes: undefined,
      issueDate: undefined,
      expiryDate: undefined,
    },
  });

  const type = watch("type");
  const issueDateValue = parseDateInput(watch("issueDate"));
  const expiryDateValue = parseDateInput(watch("expiryDate"));

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      reset({
        name: "",
        type: "other",
        category: undefined,
        tags: "",
        notes: undefined,
        issueDate: undefined,
        expiryDate: undefined,
      });
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
    // Auto-populate name if empty and we have a filename from the upload
    const currentName = watch("name");
    if (!currentName && payload.publicId) {
      // Extract filename from publicId or use a default
      const parts = payload.publicId.split("/");
      const filename = parts[parts.length - 1] || "document";
      setValue("name", filename);
    }
  };

  const onSubmit = async (data: DocumentFormValues) => {
    if (!uploadedFile) {
      toast.error("Please upload a document first");
      return;
    }

    try {
      const payload: UploadDocumentInput = {
        name: data.name,
        type: data.type as TeacherDocumentType,
        category: data.category || null,
        fileUrl: uploadedFile.url,
        fileMime: uploadedFile.mimeType || null,
        fileSize: uploadedFile.bytes,
        tags: data.tags
          ? data.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
        notes: data.notes || null,
        issueDate: data.issueDate || null,
        expiryDate: data.expiryDate || null,
      };

      await uploadDocumentMutation.mutateAsync({
        teacherId,
        payload,
      });

      toast.success("Document uploaded successfully");
      onOpenChange(false);
    } catch (e: unknown) {
      const error = e as { message?: string };
      toast.error(error.message || "Failed to upload document");
    }
  };

  const isPending = uploadDocumentMutation.isPending || isSubmitting;

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
              className="w-full max-w-[860px] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 text-white shadow-2xl shadow-black/40"
            >
              <div className="px-6 pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h1 className="text-lg font-semibold">Upload Document</h1>
                    <p className="text-sm text-white/60">
                      School ID not available.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                    onClick={() => onOpenChange(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-5 h-px bg-white/10" />
              </div>

              <div className="px-6 py-6">
                <p className="text-sm text-white/70">
                  Please refresh and try again once your school profile is
                  available.
                </p>
              </div>
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
            className="w-full max-w-[860px] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 text-white shadow-2xl shadow-black/40"
          >
            <div className="px-6 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="text-lg font-semibold">Upload Document</h1>
                  <p className="text-sm text-white/60">
                    Upload a document for{" "}
                    <span className="font-medium text-white/85">
                      {teacherName}
                    </span>
                    .
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  className="h-9 w-9 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-5 h-px bg-white/10" />
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
                      Document File *
                    </Label>
                    <DocumentUploader
                      schoolId={me.schoolId}
                      category="teachers"
                      maxSizeMB={15}
                      onUploaded={handleFileUploaded}
                      onError={(msg) => toast.error(msg)}
                      label={
                        uploadedFile ? "File uploaded successfully" : "Upload document"
                      }
                    />
                    {uploadedFile && (
                      <p className="text-xs text-muted-foreground">
                        File size: {(uploadedFile.bytes / 1024 / 1024).toFixed(2)}{" "}
                        MB
                      </p>
                    )}
                    {!uploadedFile && (
                      <p className="text-xs text-muted-foreground">
                        Please upload a document file to continue
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label
                        htmlFor="name"
                        className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                      >
                        Document Name *
                      </Label>
                      <Input
                        id="name"
                        {...register("name")}
                        placeholder="e.g., Teaching License"
                        className="border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      />
                      {errors.name && (
                        <p className="text-xs text-red-300/80">
                          {errors.name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="type"
                        className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                      >
                        Document Type *
                      </Label>
                      <Select
                        value={type}
                        onValueChange={(value) =>
                          setValue("type", value as TeacherDocumentType)
                        }
                      >
                        <SelectTrigger className="border border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-1 focus:ring-brand">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className={premiumSelectContent}>
                          <SelectItem value="contract" className={premiumMenuItem}>
                            Contract
                          </SelectItem>
                          <SelectItem
                            value="certificate"
                            className={premiumMenuItem}
                          >
                            Certificate
                          </SelectItem>
                          <SelectItem value="license" className={premiumMenuItem}>
                            License
                          </SelectItem>
                          <SelectItem value="id" className={premiumMenuItem}>
                            ID
                          </SelectItem>
                          <SelectItem value="resume" className={premiumMenuItem}>
                            Resume
                          </SelectItem>
                          <SelectItem value="other" className={premiumMenuItem}>
                            Other
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.type && (
                        <p className="text-xs text-red-300/80">
                          {errors.type.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="category"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Category (optional)
                    </Label>
                    <Input
                      id="category"
                      {...register("category")}
                      placeholder="e.g., Professional, Personal"
                      className="border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <CustomDatePicker
                        value={issueDateValue}
                        onChange={(date) =>
                          setValue("issueDate", date ? formatDateInput(date) : "", {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        label="Issue Date (optional)"
                        placeholder="Select issue date"
                        maxDate={expiryDateValue || undefined}
                      />
                    </div>

                    <div className="space-y-2">
                      <CustomDatePicker
                        value={expiryDateValue}
                        onChange={(date) =>
                          setValue("expiryDate", date ? formatDateInput(date) : "", {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                        label="Expiry Date (optional)"
                        placeholder="Select expiry date"
                        minDate={issueDateValue || undefined}
                        error={errors.expiryDate?.message}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="tags"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Tags (optional, comma-separated)
                    </Label>
                    <Input
                      id="tags"
                      {...register("tags")}
                      placeholder="e.g., important, renewal, annual"
                      className="border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="notes"
                      className="text-xs font-medium uppercase tracking-[0.2em] text-muted"
                    >
                      Notes (optional)
                    </Label>
                    <Textarea
                      id="notes"
                      {...register("notes")}
                      placeholder="Additional notes about this document..."
                      className="min-h-[80px] border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                      maxLength={1000}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={isPending}
                      className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isPending || !uploadedFile}
                      className="gap-2 bg-brand text-black hover:opacity-90"
                    >
                      {isPending ? "Uploading…" : "Upload Document"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
