"use client";

import * as React from "react";
import { Plus, X, Link as LinkIcon, Package, Upload, FileText, Image as ImageIcon, Video, File } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { cn } from "@/lib/utils";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useUploadThing } from "@/lib/uploadthing/react";
import type { LessonNoteFormData, LessonNoteResource } from "@/types/lesson-notes";
import { COMMON_TLMS, RESOURCE_TYPES } from "@/types/lesson-notes";

// Helper to check if type requires file upload vs URL input
const FILE_UPLOAD_TYPES = ["pdf", "image", "doc", "slides", "other"];

type ResourcesStepProps = {
  formData: LessonNoteFormData;
  onUpdate: (updates: Partial<LessonNoteFormData>) => void;
};

export function ResourcesStep({ formData, onUpdate }: ResourcesStepProps) {
  const [customTlm, setCustomTlm] = React.useState("");
  const { data: contextData } = useTeacherContext();
  const schoolId = contextData?.data?.school?._id;

  // Toggle TLM
  const toggleTlm = (tlm: string) => {
    const current = formData.tlms || [];
    if (current.includes(tlm)) {
      onUpdate({ tlms: current.filter((t) => t !== tlm) });
    } else {
      onUpdate({ tlms: [...current, tlm] });
    }
  };

  // Add custom TLM
  const addCustomTlm = () => {
    if (!customTlm.trim()) return;
    const current = formData.tlms || [];
    if (!current.includes(customTlm.trim())) {
      onUpdate({ tlms: [...current, customTlm.trim()] });
    }
    setCustomTlm("");
  };

  // Add resource
  const addResource = () => {
    const newResource: LessonNoteResource = { title: "", url: "", type: "link" };
    onUpdate({ resources: [...formData.resources, newResource] });
  };

  // Update resource
  const updateResource = (index: number, updates: Partial<LessonNoteResource>) => {
    const resources = [...formData.resources];
    resources[index] = { ...resources[index], ...updates };
    onUpdate({ resources });
  };

  // Remove resource
  const removeResource = (index: number) => {
    onUpdate({ resources: formData.resources.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Teaching Resources</h2>
        <p className="text-sm text-white/60">
          Select materials and add external resources for your lesson
        </p>
      </div>

      {/* TLMs (Teaching Learning Materials) */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-white/70">
          <Package className="h-4 w-4" />
          Teaching & Learning Materials (TLMs)
        </Label>

        {/* Common TLMs */}
        <div className="flex flex-wrap gap-2">
          {COMMON_TLMS.map((tlm) => {
            const isSelected = (formData.tlms || []).includes(tlm);
            return (
              <button
                key={tlm}
                type="button"
                onClick={() => toggleTlm(tlm)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  isSelected
                    ? "bg-indigo-500/30 text-indigo-200 ring-1 ring-indigo-400/50"
                    : "bg-white/5 text-white/60 hover:bg-white/10"
                )}
              >
                {tlm}
              </button>
            );
          })}
        </div>

        {/* Custom TLM input */}
        <div className="flex gap-2">
          <Input
            value={customTlm}
            onChange={(e) => setCustomTlm(e.target.value)}
            placeholder="Add custom material"
            className="flex-1 border-white/10 bg-white/5 text-white"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomTlm();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={addCustomTlm}
            className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Selected TLMs */}
        {(formData.tlms || []).length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="mb-2 text-xs text-white/50">Selected materials:</p>
            <div className="flex flex-wrap gap-2">
              {(formData.tlms || []).map((tlm, index) => (
                <Badge
                  key={index}
                  className="flex items-center gap-1 bg-emerald-500/20 text-emerald-200"
                >
                  {tlm}
                  <button
                    type="button"
                    onClick={() => toggleTlm(tlm)}
                    className="ml-1 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* External Resources */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-white/70">
            <LinkIcon className="h-4 w-4" />
            External Resources
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addResource}
            className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>

        <p className="text-xs text-white/40">
          Add links to videos, documents, or online resources
        </p>

        {formData.resources.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-sm text-white/40">
            No external resources added yet.
          </div>
        ) : (
          <div className="space-y-3">
            {formData.resources.map((resource, index) => (
              <ResourceCard
                key={index}
                resource={resource}
                schoolId={schoolId}
                onUpdate={(updates) => updateResource(index, updates)}
                onRemove={() => removeResource(index)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Resource Card Component
// ============================================================================

function ResourceCard({
  resource,
  schoolId,
  onUpdate,
  onRemove,
}: {
  resource: LessonNoteResource;
  schoolId?: string;
  onUpdate: (updates: Partial<LessonNoteResource>) => void;
  onRemove: () => void;
}) {
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isFileType = FILE_UPLOAD_TYPES.includes(resource.type || "");
  const hasUrl = !!resource.url;
  const isUploading = uploadProgress !== null && uploadProgress < 100;

  // Use UploadThing for file uploads
  const { startUpload } = useUploadThing("assignmentAttachment", {
    onUploadProgress: (progress) => {
      setUploadProgress(Math.min(95, progress));
    },
    onUploadError: (error) => {
      setUploadError(error.message || "Upload failed");
      setUploadProgress(null);
    },
  });

  const getTypeIcon = () => {
    switch (resource.type) {
      case "pdf":
        return <FileText className="h-4 w-4 text-rose-400" />;
      case "image":
        return <ImageIcon className="h-4 w-4 text-emerald-400" />;
      case "video":
        return <Video className="h-4 w-4 text-purple-400" />;
      case "doc":
      case "slides":
        return <File className="h-4 w-4 text-blue-400" />;
      default:
        return <LinkIcon className="h-4 w-4 text-indigo-400" />;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Set title from filename if empty
    if (!resource.title) {
      onUpdate({ title: file.name.replace(/\.[^/.]+$/, "") });
    }

    setUploadProgress(0);
    setUploadError(null);

    try {
      const result = await startUpload([file], { schoolId });
      const uploaded = result?.[0];

      if (!uploaded) {
        throw new Error("Upload did not return a file");
      }

      const url = uploaded.serverData?.url || uploaded.ufsUrl || uploaded.url;
      
      setUploadProgress(100);
      setTimeout(() => {
        setUploadProgress(null);
      }, 500);

      onUpdate({ url });
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(error instanceof Error ? error.message : "Upload failed");
      setUploadProgress(null);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
          {getTypeIcon()}
        </div>
        <div className="flex-1">
          <Input
            value={resource.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Resource title"
            className="border-white/10 bg-white/5 text-white"
          />
        </div>
        <div className="w-28">
          <PremiumSelect
            value={resource.type || "link"}
            onValueChange={(value) => onUpdate({ type: value, url: "" })}
          >
            <PremiumSelectTrigger>
              <PremiumSelectValue />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {RESOURCE_TYPES.map((type) => (
                <PremiumSelectItem key={type.value} value={type.value}>
                  {type.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-9 w-9 p-0 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* URL input for links/videos OR File upload for other types */}
      {isFileType ? (
        <div className="space-y-2">
          {hasUrl ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
              <FileText className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              <span className="text-sm text-emerald-200 truncate flex-1">
                File uploaded successfully
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onUpdate({ url: "" })}
                className="h-6 px-2 text-xs text-emerald-300 hover:bg-emerald-500/20"
              >
                Replace
              </Button>
            </div>
          ) : isUploading ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-xs text-white/60">{uploadProgress}%</span>
              </div>
              <p className="text-xs text-white/40">Uploading...</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors",
                  uploadError
                    ? "border-rose-400/50 hover:border-rose-400/70"
                    : "border-white/10 hover:border-indigo-400/50 hover:bg-white/5"
                )}
              >
                <Upload className="h-5 w-5 text-white/40" />
                <span className="text-sm text-white/60">Click to upload file</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept={
                    resource.type === "pdf"
                      ? ".pdf"
                      : resource.type === "image"
                      ? "image/*"
                      : resource.type === "doc"
                      ? ".doc,.docx,.odt"
                      : resource.type === "slides"
                      ? ".ppt,.pptx,.odp"
                      : "*"
                  }
                />
              </div>
              {uploadError && (
                <p className="text-xs text-rose-400">{uploadError}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <Input
          value={resource.url}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder={resource.type === "video" ? "https://youtube.com/watch?v=..." : "https://..."}
          className="border-white/10 bg-white/5 text-white"
        />
      )}
    </div>
  );
}
