// src/components/modals/UploadDocumentModal.tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  useUploadDocument,
  type UploadDocumentInput,
  type TeacherDocumentType,
} from "@/hooks/admin/useTeacherDocuments";
import { premiumSelectContent, premiumMenuItem } from "@/components/ui/premium";
import { useAuth } from "@/providers/auth-provider";

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
  } | null>(null);

  const uploadDocumentMutation = useUploadDocument();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UploadDocumentInput & { tags?: string }>({
    resolver: zodResolver(UploadDocumentSchema),
    defaultValues: {
      name: "",
      type: "other",
      category: null,
      tags: "",
      notes: null,
      issueDate: null,
      expiryDate: null,
    },
  });

  const type = watch("type");

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      reset({
        name: "",
        type: "other",
        category: null,
        tags: "",
        notes: null,
        issueDate: null,
        expiryDate: null,
      });
      setUploadedFile(null);
    }
  }, [open, reset]);

  const handleFileUploaded = (payload: {
    publicId: string;
    url: string;
    bytes: number;
    format?: string;
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

  const onSubmit = async (data: UploadDocumentInput & { tags?: string }) => {
    if (!uploadedFile) {
      toast.error("Please upload a document first");
      return;
    }

    try {
      const payload: UploadDocumentInput = {
        name: data.name,
        type: data.type,
        category: data.category || null,
        fileUrl: uploadedFile.url,
        fileMime: uploadedFile.format ? `application/${uploadedFile.format}` : null,
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

  if (!me?.schoolId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <p className="text-sm text-white/60">School ID not available</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] border border-white/10 bg-linear-to-br from-white/10 to-transparent shadow-2xl shadow-black/30 backdrop-blur max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Upload Document</DialogTitle>
          <DialogDescription className="text-sm">
            Upload a document for <span className="font-medium text-white/90">{teacherName}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* File Upload */}
          <div className="space-y-2">
            <Label className="text-sm">Document File *</Label>
            <DocumentUploader
              schoolId={me.schoolId}
              category="teachers"
              maxSizeMB={15}
              onUploaded={handleFileUploaded}
              onError={(msg) => toast.error(msg)}
              label={uploadedFile ? "File uploaded successfully" : "Upload document"}
            />
            {uploadedFile && (
              <p className="text-xs text-muted-foreground">
                File size: {(uploadedFile.bytes / 1024 / 1024).toFixed(2)} MB
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
              <Label htmlFor="name" className="text-sm">
                Document Name *
              </Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="e.g., Teaching License"
                className="border-white/10 bg-white/5"
              />
              {errors.name && (
                <p className="text-xs text-red-300/80">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type" className="text-sm">
                Document Type *
              </Label>
              <Select
                value={type}
                onValueChange={(value) => setValue("type", value as TeacherDocumentType)}
              >
                <SelectTrigger className="border-white/10 bg-white/5">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className={premiumSelectContent}>
                  <SelectItem value="contract" className={premiumMenuItem}>
                    Contract
                  </SelectItem>
                  <SelectItem value="certificate" className={premiumMenuItem}>
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
                <p className="text-xs text-red-300/80">{errors.type.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm">
              Category (optional)
            </Label>
            <Input
              id="category"
              {...register("category")}
              placeholder="e.g., Professional, Personal"
              className="border-white/10 bg-white/5"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issueDate" className="text-sm">
                Issue Date (optional)
              </Label>
              <Input
                id="issueDate"
                type="date"
                {...register("issueDate")}
                className="border-white/10 bg-white/5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiryDate" className="text-sm">
                Expiry Date (optional)
              </Label>
              <Input
                id="expiryDate"
                type="date"
                {...register("expiryDate")}
                className="border-white/10 bg-white/5"
              />
              {errors.expiryDate && (
                <p className="text-xs text-red-300/80">{errors.expiryDate.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags" className="text-sm">
              Tags (optional, comma-separated)
            </Label>
            <Input
              id="tags"
              {...register("tags")}
              placeholder="e.g., important, renewal, annual"
              className="border-white/10 bg-white/5"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm">
              Notes (optional)
            </Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Additional notes about this document..."
              className="min-h-[80px] border-white/10 bg-white/5"
              maxLength={1000}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting || uploadDocumentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || uploadDocumentMutation.isPending || !uploadedFile}
              className="gap-2"
            >
              {isSubmitting || uploadDocumentMutation.isPending
                ? "Uploading…"
                : "Upload Document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
