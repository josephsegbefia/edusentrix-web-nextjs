# UploadThing Migration Plan

**From:** Cloudinary  
**To:** UploadThing  
**Date:** 2026-01-29  
**Status:** Planning

---

## Executive Summary

This document outlines the migration strategy from Cloudinary to UploadThing for all image and document uploads in EduSentrix. The migration will:

1. ✅ Keep existing Cloudinary images working (no breaking changes)
2. ✅ Route all new uploads to UploadThing
3. ✅ Maintain current UI (progress bars, previews, drag-drop)
4. ✅ Implement rollback on failed resource creation
5. ✅ Implement cascading delete (resource deletion → file deletion)
6. ✅ Organize by school folder structure

---

## Current State Analysis

### Upload Components Inventory

| Component | Location | Purpose | Used In |
|-----------|----------|---------|---------|
| `ImageUploader` | `src/components/upload/ImageUploader.tsx` | Avatar uploads with progress | CreateStudentModal, CreateTeacherModal, EditTeacherModal, GuardianForm |
| `DocumentUploader` | `src/components/upload/DocumentUploader.tsx` | Document uploads | UploadDocumentModal, TeacherDocumentsTab |
| `FileDropzone` | `src/components/upload/FileDropzone.tsx` | Base dropzone with progress bar | ImageUploader, DocumentUploader |
| `ImageUpload` | `src/components/ui/image-upload.tsx` | Simple image upload (data URL) | Limited use |
| `useUploadFile` | `src/hooks/useUploadFile.ts` | Upload hook | CreateTeacherModal |

### API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/uploads/sign` | Generate Cloudinary signature |

### Models with File URLs

| Model | Fields | Notes |
|-------|--------|-------|
| `User` | `avatarUrl`, `avatarPublicId` | User profile photos |
| `Student` | `photoUrl` | Student photos |
| `Guardian` | `photoUrl` | Via User |
| `TeacherDocument` | `fileUrl` | Teacher documents |
| `SchoolExpense` | `receipts[]` | Expense receipts |
| `FinancialTransaction` | `receipts[]` | Transaction receipts |
| `FundraisingCampaign` | `coverImageUrl`, `attachments[]` | Campaign media |
| `CommunityPoll` | `attachments[]` | Poll attachments |
| `Notice` | `attachments[]` | Notice attachments |
| `Homework` | `attachments[]` | Assignment files |
| `Submission` | `attachments[]` | Student submissions |

### Current Deletion Behavior

| Scenario | Current Behavior | Required Behavior |
|----------|------------------|-------------------|
| Delete TeacherDocument | ✅ Deletes from Cloudinary | ✅ Delete from UploadThing |
| Delete Student | ❌ Photo not deleted | ✅ Delete photo |
| Delete Teacher | ❌ Photo not deleted (soft delete) | ⚠️ Consider on hard delete |
| Failed resource creation | ❌ Orphaned uploads | ✅ Rollback/delete upload |

---

## UploadThing Setup

### 1. Install Dependencies

```bash
npm install uploadthing @uploadthing/react
```

### 2. Environment Variables

```env
# .env.local
UPLOADTHING_SECRET=sk_live_...
UPLOADTHING_APP_ID=...
```

### 3. Folder Structure Convention

```
/{school-slug}/
├── students/
│   └── avatars/
│       └── {studentId}_{timestamp}.{ext}
├── teachers/
│   └── avatars/
│       └── {userId}_{timestamp}.{ext}
├── parents/
│   └── avatars/
│       └── {userId}_{timestamp}.{ext}
├── documents/
│   └── teachers/
│       └── {teacherId}_{docType}_{timestamp}.{ext}
│   └── expenses/
│       └── {expenseId}_{timestamp}.{ext}
├── campaigns/
│   └── {campaignId}/
│       └── cover.{ext}
│       └── attachments/
├── assignments/
│   └── {homeworkId}/
│       └── attachments/
└── submissions/
    └── {submissionId}/
        └── attachments/
```

---

## Implementation Plan

### Phase 1: Core UploadThing Setup

#### 1.1 Create UploadThing Core File

```typescript
// src/lib/uploadthing/core.ts
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { School } from "@/models/School";

const f = createUploadthing();

// Helper to get school slug from school ID
async function getSchoolSlug(schoolId: string): Promise<string> {
  await connectToDatabase();
  const school = await School.findById(schoolId).select("name slug").lean();
  if (!school) throw new Error("School not found");
  // Use slug if available, otherwise create from name
  return school.slug || school.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// Helper to get user's school
async function getUserSchool() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  
  await connectToDatabase();
  const user = await User.findOne({ clerkUserId: userId }).select("schoolId").lean();
  if (!user?.schoolId) throw new Error("No school associated");
  
  return {
    userId: user._id.toString(),
    schoolId: user.schoolId.toString(),
  };
}

export const ourFileRouter = {
  // Student avatars
  studentAvatar: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      const { userId, schoolId } = await getUserSchool();
      const schoolSlug = await getSchoolSlug(schoolId);
      return { userId, schoolId, schoolSlug, folder: "students/avatars" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { 
        url: file.url,
        key: file.key,
        name: file.name,
        size: file.size,
        schoolSlug: metadata.schoolSlug,
        folder: metadata.folder,
      };
    }),

  // Teacher avatars
  teacherAvatar: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      const { userId, schoolId } = await getUserSchool();
      const schoolSlug = await getSchoolSlug(schoolId);
      return { userId, schoolId, schoolSlug, folder: "teachers/avatars" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { 
        url: file.url,
        key: file.key,
        name: file.name,
        size: file.size,
      };
    }),

  // Parent/Guardian avatars
  parentAvatar: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      const { userId, schoolId } = await getUserSchool();
      const schoolSlug = await getSchoolSlug(schoolId);
      return { userId, schoolId, schoolSlug, folder: "parents/avatars" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { 
        url: file.url,
        key: file.key,
        name: file.name,
        size: file.size,
      };
    }),

  // Teacher documents
  teacherDocument: f({ 
    pdf: { maxFileSize: "16MB" },
    image: { maxFileSize: "8MB" },
    "application/msword": { maxFileSize: "16MB" },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { maxFileSize: "16MB" },
  })
    .middleware(async () => {
      const { userId, schoolId } = await getUserSchool();
      const schoolSlug = await getSchoolSlug(schoolId);
      return { userId, schoolId, schoolSlug, folder: "documents/teachers" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { 
        url: file.url,
        key: file.key,
        name: file.name,
        size: file.size,
        type: file.type,
      };
    }),

  // Expense receipts
  expenseReceipt: f({ 
    pdf: { maxFileSize: "8MB" },
    image: { maxFileSize: "4MB" },
  })
    .middleware(async () => {
      const { userId, schoolId } = await getUserSchool();
      const schoolSlug = await getSchoolSlug(schoolId);
      return { userId, schoolId, schoolSlug, folder: "documents/expenses" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { 
        url: file.url,
        key: file.key,
        name: file.name,
        size: file.size,
      };
    }),

  // Assignment attachments (Teacher Studio)
  assignmentAttachment: f({ 
    pdf: { maxFileSize: "16MB" },
    image: { maxFileSize: "8MB" },
    video: { maxFileSize: "64MB" },
    audio: { maxFileSize: "16MB" },
  })
    .middleware(async () => {
      const { userId, schoolId } = await getUserSchool();
      const schoolSlug = await getSchoolSlug(schoolId);
      return { userId, schoolId, schoolSlug, folder: "assignments" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { 
        url: file.url,
        key: file.key,
        name: file.name,
        size: file.size,
        type: file.type,
      };
    }),

  // Student submission attachments
  submissionAttachment: f({ 
    pdf: { maxFileSize: "16MB" },
    image: { maxFileSize: "8MB" },
    video: { maxFileSize: "64MB" },
  })
    .middleware(async () => {
      const { userId, schoolId } = await getUserSchool();
      const schoolSlug = await getSchoolSlug(schoolId);
      return { userId, schoolId, schoolSlug, folder: "submissions" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { 
        url: file.url,
        key: file.key,
        name: file.name,
        size: file.size,
        type: file.type,
      };
    }),

  // Campaign media
  campaignMedia: f({ 
    image: { maxFileSize: "8MB" },
    video: { maxFileSize: "64MB" },
  })
    .middleware(async () => {
      const { userId, schoolId } = await getUserSchool();
      const schoolSlug = await getSchoolSlug(schoolId);
      return { userId, schoolId, schoolSlug, folder: "campaigns" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { 
        url: file.url,
        key: file.key,
        name: file.name,
        size: file.size,
        type: file.type,
      };
    }),

  // Notice attachments
  noticeAttachment: f({ 
    pdf: { maxFileSize: "8MB" },
    image: { maxFileSize: "4MB" },
  })
    .middleware(async () => {
      const { userId, schoolId } = await getUserSchool();
      const schoolSlug = await getSchoolSlug(schoolId);
      return { userId, schoolId, schoolSlug, folder: "notices" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { 
        url: file.url,
        key: file.key,
        name: file.name,
        size: file.size,
        type: file.type,
      };
    }),

} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
```

#### 1.2 Create API Route

```typescript
// src/app/api/uploadthing/route.ts
import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "@/lib/uploadthing/core";

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
});
```

#### 1.3 Create Delete Helper

```typescript
// src/lib/uploadthing/delete.ts
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

/**
 * Delete a file from UploadThing by its key or URL
 */
export async function deleteUploadThingFile(keyOrUrl: string): Promise<boolean> {
  try {
    // Extract key from URL if needed
    let key = keyOrUrl;
    if (keyOrUrl.startsWith("https://")) {
      // UploadThing URLs look like: https://utfs.io/f/{key}
      const match = keyOrUrl.match(/\/f\/(.+)$/);
      if (match) {
        key = match[1];
      } else {
        console.warn("Could not extract key from URL:", keyOrUrl);
        return false;
      }
    }

    await utapi.deleteFiles(key);
    return true;
  } catch (error) {
    console.error("Failed to delete from UploadThing:", error);
    return false;
  }
}

/**
 * Delete multiple files from UploadThing
 */
export async function deleteUploadThingFiles(keysOrUrls: string[]): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;

  for (const keyOrUrl of keysOrUrls) {
    const success = await deleteUploadThingFile(keyOrUrl);
    if (success) deleted++;
    else failed++;
  }

  return { deleted, failed };
}
```

#### 1.4 Create Provider Detection Helper

```typescript
// src/lib/uploads/provider.ts

type UploadProvider = "uploadthing" | "cloudinary" | "unknown";

/**
 * Detect which upload provider a URL belongs to
 */
export function detectUploadProvider(url: string): UploadProvider {
  if (!url) return "unknown";
  
  // UploadThing URLs
  if (url.includes("utfs.io") || url.includes("uploadthing")) {
    return "uploadthing";
  }
  
  // Cloudinary URLs
  if (url.includes("cloudinary.com") || url.includes("res.cloudinary.com")) {
    return "cloudinary";
  }
  
  return "unknown";
}

/**
 * Check if URL is from Cloudinary (legacy)
 */
export function isCloudinaryUrl(url: string): boolean {
  return detectUploadProvider(url) === "cloudinary";
}

/**
 * Check if URL is from UploadThing (new)
 */
export function isUploadThingUrl(url: string): boolean {
  return detectUploadProvider(url) === "uploadthing";
}
```

---

### Phase 2: Unified Delete Helper

```typescript
// src/lib/uploads/delete.ts
import { deleteUploadThingFile } from "@/lib/uploadthing/delete";
import { detectUploadProvider } from "./provider";
import { v2 as cloudinary } from "cloudinary";

/**
 * Delete a file from whatever provider it's hosted on
 * Works for both Cloudinary (legacy) and UploadThing (new)
 */
export async function deleteUploadedFile(url: string): Promise<boolean> {
  if (!url) return true; // Nothing to delete
  
  const provider = detectUploadProvider(url);
  
  switch (provider) {
    case "uploadthing":
      return deleteUploadThingFile(url);
    
    case "cloudinary":
      return deleteCloudinaryFile(url);
    
    default:
      console.warn("Unknown upload provider for URL:", url);
      return false;
  }
}

async function deleteCloudinaryFile(url: string): Promise<boolean> {
  try {
    // Initialize Cloudinary
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    // Extract public_id from URL
    // Image URLs: https://res.cloudinary.com/{cloud}/image/upload/{transformations}/{public_id}
    // Raw URLs: https://res.cloudinary.com/{cloud}/raw/upload/{public_id}
    
    let publicId: string | null = null;
    let resourceType: "image" | "raw" = "image";
    
    if (url.includes("/raw/upload/")) {
      resourceType = "raw";
      const parts = url.split("/raw/upload/");
      if (parts.length === 2) {
        publicId = parts[1];
      }
    } else if (url.includes("/image/upload/")) {
      resourceType = "image";
      // Image URLs have transformations, so we need to extract more carefully
      const match = url.match(/\/image\/upload\/(?:.*\/)?([^/]+\/[^/]+)$/);
      if (match) {
        publicId = match[1];
      }
    }

    if (!publicId) {
      console.warn("Could not extract public_id from Cloudinary URL:", url);
      return false;
    }

    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return true;
  } catch (error) {
    console.error("Failed to delete from Cloudinary:", error);
    return false;
  }
}

/**
 * Delete multiple files
 */
export async function deleteUploadedFiles(urls: string[]): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;

  for (const url of urls) {
    const success = await deleteUploadedFile(url);
    if (success) deleted++;
    else failed++;
  }

  return { deleted, failed };
}
```

---

### Phase 3: Updated Upload Components

#### 3.1 New ImageUploader with UploadThing

```typescript
// src/components/upload/ImageUploader.tsx
"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useUploadThing } from "@/lib/uploadthing/react";
import { useToast } from "@/hooks/useToast";
import { X, Upload } from "lucide-react";
import Image from "next/image";
import clsx from "clsx";

type ImageUploaderProps = {
  endpoint: "studentAvatar" | "teacherAvatar" | "parentAvatar" | "campaignMedia";
  maxSizeMB?: number;
  onUploaded: (payload: {
    url: string;
    key: string;
    name: string;
    size: number;
  }) => void;
  onError?: (msg: string) => void;
  className?: string;
  label?: string;
  existingUrl?: string;
  onRemove?: () => void;
};

export function ImageUploader({
  endpoint,
  maxSizeMB = 4,
  onUploaded,
  onError,
  className,
  label = "Upload image",
  existingUrl,
  onRemove,
}: ImageUploaderProps) {
  const [preview, setPreview] = useState<string | null>(existingUrl || null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const toast = useToast();

  const { startUpload, isUploading, permittedFileInfo } = useUploadThing(endpoint, {
    onClientUploadComplete: (res) => {
      if (res && res[0]) {
        const file = res[0];
        setPreview(file.url);
        setLocalPreview(null);
        onUploaded({
          url: file.url,
          key: file.key,
          name: file.name,
          size: file.size,
        });
        toast.success("Image uploaded successfully");
      }
    },
    onUploadError: (error) => {
      setLocalPreview(null);
      const msg = error.message || "Upload failed";
      toast.error("Upload failed", { description: msg });
      onError?.(msg);
    },
    onUploadProgress: (progress) => {
      setUploadProgress(progress);
    },
  });

  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Validate size
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        toast.error(`File too large (max ${maxSizeMB}MB)`);
        return;
      }

      // Create local preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload
      setUploadProgress(0);
      await startUpload([file]);
    },
    [startUpload, maxSizeMB, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [],
      "image/png": [],
      "image/webp": [],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  const displayPreview = preview || localPreview;

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    setLocalPreview(null);
    onRemove?.();
  };

  return (
    <div className={className}>
      {label && (
        <div className="text-sm font-medium text-white/90 mb-2">{label}</div>
      )}
      <div
        {...getRootProps()}
        className={clsx(
          "relative rounded-2xl border border-white/10 bg-white/5 transition-all cursor-pointer",
          "p-6 md:p-8",
          isDragActive && "border-blue-400/50 bg-blue-400/10",
          isUploading && "opacity-60 cursor-not-allowed"
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent rounded-2xl" />
        
        <div className="flex items-center gap-4">
          <div className="relative rounded-xl border border-white/10 bg-white/5 p-3 overflow-hidden flex-shrink-0">
            {displayPreview ? (
              <>
                <Image
                  src={displayPreview}
                  alt="Preview"
                  width={48}
                  height={48}
                  className="w-12 h-12 object-cover rounded-lg"
                />
                {isUploading && uploadProgress < 100 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                    <span className="text-xs font-semibold text-white">
                      {Math.round(uploadProgress)}%
                    </span>
                  </div>
                )}
              </>
            ) : (
              <Upload className="w-6 h-6 text-white/80" />
            )}
          </div>
          
          <div className="flex-1">
            <div className="text-white font-semibold">
              {displayPreview ? "Image uploaded" : "Drag & drop or click to upload"}
            </div>
            <div className="text-xs text-white/60 mt-1">
              {isUploading
                ? `Uploading... ${Math.round(uploadProgress)}%`
                : displayPreview
                ? "Click to replace image"
                : `JPG, PNG, WEBP • Max ${maxSizeMB}MB`}
            </div>
            {isUploading && (
              <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>

          {displayPreview && !isUploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="p-2 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <input {...getInputProps()} />
      </div>
    </div>
  );
}
```

#### 3.2 New DocumentUploader with UploadThing

```typescript
// src/components/upload/DocumentUploader.tsx  
"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useUploadThing } from "@/lib/uploadthing/react";
import { useToast } from "@/hooks/useToast";
import { File, Upload, X, Check } from "lucide-react";
import clsx from "clsx";

type DocumentUploaderProps = {
  endpoint: "teacherDocument" | "expenseReceipt" | "assignmentAttachment" | "submissionAttachment" | "noticeAttachment";
  maxSizeMB?: number;
  onUploaded: (payload: {
    url: string;
    key: string;
    name: string;
    size: number;
    type?: string;
  }) => void;
  onError?: (msg: string) => void;
  className?: string;
  label?: string;
};

export function DocumentUploader({
  endpoint,
  maxSizeMB = 16,
  onUploaded,
  onError,
  className,
  label = "Upload document",
}: DocumentUploaderProps) {
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const toast = useToast();

  const { startUpload, isUploading } = useUploadThing(endpoint, {
    onClientUploadComplete: (res) => {
      if (res && res[0]) {
        const file = res[0];
        setUploadedFile({ name: file.name, size: file.size });
        onUploaded({
          url: file.url,
          key: file.key,
          name: file.name,
          size: file.size,
          type: file.type,
        });
        toast.success("Document uploaded successfully");
      }
    },
    onUploadError: (error) => {
      setUploadedFile(null);
      const msg = error.message || "Upload failed";
      toast.error("Upload failed", { description: msg });
      onError?.(msg);
    },
    onUploadProgress: (progress) => {
      setUploadProgress(progress);
    },
  });

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        toast.error(`File too large (max ${maxSizeMB}MB)`);
        return;
      }

      setUploadedFile(null);
      setUploadProgress(0);
      await startUpload([file]);
    },
    [startUpload, maxSizeMB, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [],
      "image/jpeg": [],
      "image/png": [],
      "image/webp": [],
      "text/csv": [],
      "application/vnd.ms-excel": [],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [],
      "application/msword": [],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  return (
    <div className={className}>
      {label && (
        <div className="text-sm font-medium text-white/90 mb-2">{label}</div>
      )}
      <div
        {...getRootProps()}
        className={clsx(
          "relative rounded-2xl border border-white/10 bg-white/5 transition-all cursor-pointer",
          "p-6 md:p-8",
          isDragActive && "border-blue-400/50 bg-blue-400/10",
          isUploading && "opacity-60 cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex-shrink-0">
            {uploadedFile ? (
              <Check className="w-6 h-6 text-green-400" />
            ) : isUploading ? (
              <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            ) : (
              <File className="w-6 h-6 text-white/80" />
            )}
          </div>
          
          <div className="flex-1">
            <div className="text-white font-semibold">
              {uploadedFile
                ? uploadedFile.name
                : "Drag & drop or click to upload"}
            </div>
            <div className="text-xs text-white/60 mt-1">
              {isUploading
                ? `Uploading... ${Math.round(uploadProgress)}%`
                : uploadedFile
                ? `${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB`
                : `PDF, CSV, XLS/XLSX, DOC/DOCX, Images • Max ${maxSizeMB}MB`}
            </div>
            {isUploading && (
              <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <input {...getInputProps()} />
      </div>
    </div>
  );
}
```

---

### Phase 4: Rollback on Failed Resource Creation

Create a utility for two-phase commit pattern:

```typescript
// src/lib/uploads/rollback.ts
import { deleteUploadedFile } from "./delete";

type PendingUpload = {
  url: string;
  key?: string;
};

/**
 * Upload manager for handling rollback on failed resource creation
 * 
 * Usage:
 * const uploads = new UploadRollbackManager();
 * 
 * // Track uploads as they happen
 * uploads.add({ url: uploadResult.url, key: uploadResult.key });
 * 
 * try {
 *   // Create resource in database
 *   await createStudent({ photoUrl: uploadResult.url });
 *   
 *   // Success - don't rollback
 *   uploads.commit();
 * } catch (error) {
 *   // Failed - delete uploaded files
 *   await uploads.rollback();
 *   throw error;
 * }
 */
export class UploadRollbackManager {
  private uploads: PendingUpload[] = [];
  private committed = false;

  add(upload: PendingUpload) {
    if (this.committed) {
      throw new Error("Cannot add uploads after commit");
    }
    this.uploads.push(upload);
  }

  commit() {
    this.committed = true;
    this.uploads = []; // Clear the list, no rollback needed
  }

  async rollback(): Promise<{ deleted: number; failed: number }> {
    if (this.committed) {
      return { deleted: 0, failed: 0 };
    }

    let deleted = 0;
    let failed = 0;

    for (const upload of this.uploads) {
      const success = await deleteUploadedFile(upload.url);
      if (success) deleted++;
      else failed++;
    }

    this.uploads = [];
    return { deleted, failed };
  }
}
```

### Phase 5: Update Resource Deletion to Clean Up Files

Example for Student deletion:

```typescript
// In student delete route - add file cleanup
import { deleteUploadedFile } from "@/lib/uploads/delete";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // ... existing auth and validation ...

  const student = await Student.findById(studentId);
  if (!student) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Delete photo if exists
  if (student.photoUrl) {
    await deleteUploadedFile(student.photoUrl);
  }

  // Delete student record
  await Student.findByIdAndDelete(studentId);

  return Response.json({ success: true });
}
```

---

### Phase 6: React Hook for UploadThing

```typescript
// src/lib/uploadthing/react.ts
import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "./core";

export const { useUploadThing, uploadFiles } =
  generateReactHelpers<OurFileRouter>();
```

---

## Migration Strategy for Existing Images

### Option 1: Keep Cloudinary Images (Recommended)

Since Cloudinary URLs will continue to work indefinitely (as long as you maintain the account), the simplest approach is:

1. ✅ Keep existing Cloudinary images where they are
2. ✅ All new uploads go to UploadThing
3. ✅ Delete helper handles both providers
4. ✅ No migration needed

**Pros:**
- Zero downtime
- No data migration
- Old images keep working

**Cons:**
- Maintaining two providers temporarily
- Cloudinary costs continue for existing images

### Option 2: Gradual Migration Script

If you want to migrate existing images:

```typescript
// scripts/migrate-cloudinary-to-uploadthing.ts
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { UTApi } from "uploadthing/server";
import https from "https";

const utapi = new UTApi();

async function downloadFile(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
  });
}

async function migrateStudentPhotos() {
  await connectToDatabase();
  
  const students = await Student.find({
    photoUrl: { $regex: /cloudinary\.com/ },
  });

  console.log(`Found ${students.length} students with Cloudinary photos`);

  for (const student of students) {
    try {
      if (!student.photoUrl) continue;
      
      // Download from Cloudinary
      const buffer = await downloadFile(student.photoUrl);
      const file = new File([buffer], `${student._id}.jpg`, { type: "image/jpeg" });

      // Upload to UploadThing
      const result = await utapi.uploadFiles(file);
      
      if (result.data?.url) {
        // Update student record
        await Student.findByIdAndUpdate(student._id, {
          $set: { photoUrl: result.data.url },
        });
        console.log(`✓ Migrated ${student._id}`);
      }
    } catch (error) {
      console.error(`✗ Failed ${student._id}:`, error);
    }
  }
}

migrateStudentPhotos();
```

---

## Files to Create/Modify

### New Files

```
src/lib/uploadthing/
├── core.ts                    # File router definition
├── react.ts                   # React helpers
└── delete.ts                  # Delete helper

src/lib/uploads/
├── provider.ts                # Provider detection
├── delete.ts                  # Unified delete (both providers)
└── rollback.ts                # Rollback manager

src/app/api/uploadthing/
└── route.ts                   # UploadThing API route
```

### Files to Modify

```
src/components/upload/
├── ImageUploader.tsx          # Switch to UploadThing
└── DocumentUploader.tsx       # Switch to UploadThing

src/components/modals/
├── CreateStudentModal.tsx     # Update ImageUploader usage
├── CreateTeacherModal.tsx     # Update ImageUploader usage
├── EditTeacherModal.tsx       # Update ImageUploader usage
├── UploadDocumentModal.tsx    # Update DocumentUploader usage
└── CreateExpenseModal.tsx     # Update DocumentUploader usage

src/hooks/
└── useUploadFile.ts           # Remove or replace with UploadThing hook

src/app/api/admin/
├── students/[id]/route.ts     # Add photo deletion on delete
├── teachers/[id]/route.ts     # Add photo deletion on hard delete
└── teachers/[id]/documents/[docId]/route.ts  # Update to use unified delete

src/app/api/uploads/
└── sign/route.ts              # Keep for backward compatibility (Cloudinary)
```

---

## Testing Checklist

- [ ] New uploads go to UploadThing
- [ ] Existing Cloudinary images still display
- [ ] Progress bar works during upload
- [ ] Preview shows after upload
- [ ] Failed resource creation deletes uploaded file
- [ ] Resource deletion deletes associated files
- [ ] File organization by school folder works
- [ ] All upload endpoints work (student, teacher, document, etc.)

---

## Rollout Plan

### Week 1: Setup & Core
1. Install UploadThing package
2. Create file router
3. Create API route
4. Create delete helpers
5. Test in development

### Week 2: Component Migration
1. Update ImageUploader
2. Update DocumentUploader
3. Update all modals
4. Test all upload flows

### Week 3: Cleanup & Deletion
1. Implement rollback on failed creation
2. Add file deletion to resource deletion
3. Test deletion flows
4. Monitor for issues

### Week 4: Cleanup
1. Remove unused Cloudinary code (optional)
2. Monitor UploadThing usage
3. Document changes

---

## Environment Variables

```env
# UploadThing (new)
UPLOADTHING_SECRET=sk_live_...
UPLOADTHING_APP_ID=...

# Cloudinary (keep for existing images)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
```

---

## Cost Considerations

**UploadThing Pricing (as of 2024):**
- Free tier: 2GB storage, 2GB/month bandwidth
- Pro: $10/month for 20GB storage, 20GB/month bandwidth
- Pay as you go after limits

**Cloudinary (keep for existing):**
- Continue existing plan for legacy images
- Can eventually migrate and cancel

---

## Background Removal (Client-Side)

Since UploadThing doesn't have built-in image transformations like Cloudinary's `e_background_removal`, we process images **before** upload using client-side AI.

### Package Installed

```bash
npm install @imgly/background-removal
```

### How It Works

1. **100% Client-Side** - Runs in browser via WebAssembly
2. **No API Costs** - No per-image fees
3. **Privacy** - Images never leave the browser
4. **First Use** - Downloads ~5MB WASM model (cached after)

### Files Created

```
src/lib/image/remove-background.ts    # Background removal utility
src/hooks/useImageUpload.ts           # Hook combining bg removal + upload
```

### Usage Example

```typescript
import { useImageUpload } from "@/hooks/useImageUpload";

function AvatarUploader({ onComplete }: { onComplete: (url: string) => void }) {
  const { upload, progress, preview, isProcessing } = useImageUpload({
    endpoint: "studentAvatar",
    removeBackground: true,           // Enable BG removal (default: true)
    backgroundColor: "#FFFFFF",       // White background after removal
    onSuccess: (result) => onComplete(result.url),
    onError: (error) => console.error(error),
  });

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        disabled={isProcessing}
      />
      
      {preview && <img src={preview} alt="Preview" />}
      
      <div>
        {progress.stage === "removing-background" && (
          <span>Removing background... {progress.progress}%</span>
        )}
        {progress.stage === "uploading" && (
          <span>Uploading... {progress.progress}%</span>
        )}
      </div>
    </div>
  );
}
```

### Progress Stages

| Stage | Progress | Description |
|-------|----------|-------------|
| `idle` | 0% | Not started |
| `removing-background` | 0-50% | AI processing image |
| `uploading` | 50-100% | Uploading to UploadThing |
| `done` | 100% | Complete |
| `error` | 0% | Failed |

### Options

```typescript
// Disable background removal (upload original image)
useImageUpload({
  endpoint: "campaignMedia",
  removeBackground: false,
});

// Transparent background (PNG)
useImageUpload({
  endpoint: "studentAvatar",
  removeBackground: true,
  backgroundColor: "transparent",
});

// Custom background color
useImageUpload({
  endpoint: "teacherAvatar",
  removeBackground: true,
  backgroundColor: "#F0F0F0",
});
```

### Standalone Background Removal

```typescript
import { 
  removeImageBackground,
  isBackgroundRemovalSupported,
  preloadBackgroundRemovalModel 
} from "@/lib/image/remove-background";

// Check browser support
if (isBackgroundRemovalSupported()) {
  // Preload model on app init (optional, faster first use)
  await preloadBackgroundRemovalModel();
}

// Remove background manually
const processedFile = await removeImageBackground(originalFile, {
  backgroundColor: "#FFFFFF",
  format: "image/png",
  onProgress: ({ stage, progress, message }) => {
    console.log(`${stage}: ${progress}% - ${message}`);
  },
});
```

### Browser Support

- ✅ Chrome 90+
- ✅ Firefox 90+
- ✅ Safari 15+
- ✅ Edge 90+
- ❌ IE11 (no WebAssembly)

### Alternative: Server-Side Background Removal

If client-side processing is too slow or you need higher quality:

| Service | Cost | Quality | Speed |
|---------|------|---------|-------|
| `@imgly/background-removal` (current) | Free | Good | Medium |
| Remove.bg API | $0.20/image | Excellent | Fast |
| Replicate (rembg model) | ~$0.002/image | Good | Medium |

To switch to server-side, create an API route:

```typescript
// src/app/api/image/remove-background/route.ts
import { removeBackground } from "@imgly/background-removal-node";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  
  const buffer = await file.arrayBuffer();
  const result = await removeBackground(new Uint8Array(buffer));
  
  return new Response(result, {
    headers: { "Content-Type": "image/png" }
  });
}
```

---

**End of Migration Plan**
