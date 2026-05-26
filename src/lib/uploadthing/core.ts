import { auth } from "@clerk/nextjs/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { User } from "@/models/User";
import { AdmissionApplication } from "@/models/AdmissionApplication";
import { AdmissionCycle } from "@/models/AdmissionCycle";
import { Student } from "@/models/Student";
import { createUploadthing, type FileRouter, UTFiles } from "uploadthing/next";
import { z } from "zod";
import { checkUsageLimit } from "@/lib/billing/check-usage-limit";
import { trackUsage } from "@/lib/billing/trackUsage";
import { enforceDemoPolicy } from "@/lib/demo/action-policy";
import { canUploadLibraryBookCover } from "@/lib/library/library-upload-gate";

const f = createUploadthing();
const RouteInput = z.object({
  schoolId: z.string().trim().min(1).optional(),
});

const PublicAdmissionInput = z
  .object({
    /** Tracker token of an existing AdmissionApplication, OR */
    applicantToken: z.string().trim().min(16).optional(),
    /** Cycle slug + schoolId for first-time uploads while filling the form. */
    schoolId: z.string().trim().min(1).optional(),
    cycleSlug: z.string().trim().min(1).optional(),
    /** Secure token from an admissions-requested supplemental upload email. */
    supplementalRequestToken: z.string().trim().min(24).optional(),
    /** Secure token from a school “request document from parent” email. */
    studentParentDocumentToken: z.string().trim().min(24).optional(),
  })
  .superRefine((data, ctx) => {
    const n = [
      Boolean(data.supplementalRequestToken),
      Boolean(data.studentParentDocumentToken),
      Boolean(data.applicantToken),
      Boolean(data.schoolId && data.cycleSlug),
    ].filter(Boolean).length;
    if (n !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Provide exactly one of supplementalRequestToken, studentParentDocumentToken, applicantToken, or schoolId+cycleSlug",
        path: ["applicantToken"],
      });
    }
  });

type UploadMetadata = {
  userId: string;
  schoolId: string;
  schoolSlug: string;
  folder: string;
  role?: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeFileName(name: string): string {
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  const base = parts.join(".") || "file";
  const cleanBase = base
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const cleanExt = (ext || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12);

  return cleanExt ? `${cleanBase || "file"}.${cleanExt}` : cleanBase || "file";
}

async function getUploaderContext(requestedSchoolId?: string) {
  enforceDemoPolicy("uploadthing", "upload");

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    throw new Error("Unauthorized");
  }

  await connectToDatabase();

  const user = await User.findOne({ clerkUserId })
    .select("_id role schoolId")
    .lean<{
      _id: { toString(): string };
      role?: string;
      schoolId?: { toString(): string } | null;
    }>();

  if (!user) {
    throw new Error("User not found");
  }
  const userSchoolId = user.schoolId?.toString();
  let effectiveSchoolId = userSchoolId;

  if (requestedSchoolId && requestedSchoolId !== userSchoolId) {
    if (user.role !== "platform_admin") {
      throw new Error("Forbidden school upload target");
    }
    effectiveSchoolId = requestedSchoolId;
  }

  if (!effectiveSchoolId) {
    throw new Error("No school associated with user");
  }

  const school = await School.findById(effectiveSchoolId)
    .select("name")
    .lean<{ name?: string }>();

  const schoolSlug = slugify(school?.name || effectiveSchoolId || "school");

  return {
    userId: user._id.toString(),
    schoolId: effectiveSchoolId,
    schoolSlug,
    role: user.role || undefined,
  };
}

async function buildMetadata(
  folder: string,
  files: ReadonlyArray<{ name: string; size?: number }>,
  requestedSchoolId?: string
) {
  const context = await getUploaderContext(requestedSchoolId);
  const timestamp = Date.now();
  const incomingBytes = files.reduce(
    (sum, file) => sum + Math.max(0, Number(file.size || 0)),
    0
  );

  // Storage uploads are not AI — do not gate on expensive-ai access mode.
  const storageLimit = await checkUsageLimit({
    schoolId: context.schoolId,
    limitKey: "maxStorageBytes",
    increment: incomingBytes,
  });
  if (!storageLimit.allowed) {
    const limitGb =
      storageLimit.limit != null
        ? `${(storageLimit.limit / (1024 * 1024 * 1024)).toFixed(1)} GB`
        : null;
    throw new Error(
      storageLimit.reason === "limit_exceeded" && limitGb
        ? `Storage limit reached (${limitGb} on your plan). Remove old files or contact your school admin.`
        : "Storage limit reached for this subscription.",
    );
  }

  const filesWithCustomIds = files.map((file, index) => ({
    ...file,
    customId: `${context.schoolSlug}/${folder}/${timestamp}-${index}-${sanitizeFileName(file.name)}`.slice(
      0,
      220
    ),
  }));

  return {
    ...context,
    folder,
    [UTFiles]: filesWithCustomIds,
  };
}

async function buildUploadResponse(metadata: UploadMetadata, file: {
  key: string;
  name: string;
  size: number;
  type: string;
  url: string;
  ufsUrl?: string;
  customId: string | null;
}) {
  try {
    await trackUsage({
      schoolId: metadata.schoolId,
      provider: "uploadthing",
      metricKey: "uploaded_assets",
      quantity: 1,
      unitLabel: "assets",
      allocationMethod: "direct",
      sourceType: "manual",
      notes: `UploadThing asset stored in ${metadata.folder}.`,
    });
    await trackUsage({
      schoolId: metadata.schoolId,
      provider: "uploadthing",
      metricKey: "uploaded_bytes",
      quantity: Math.max(0, Number(file.size || 0)),
      unitLabel: "bytes",
      allocationMethod: "direct",
      sourceType: "manual",
      notes: `UploadThing byte usage in ${metadata.folder}.`,
    });
  } catch (error) {
    console.error("UploadThing billing usage tracking failed:", error);
  }

  return {
    url: file.ufsUrl || file.url,
    key: file.key,
    name: file.name,
    size: file.size,
    type: file.type,
    customId: file.customId,
    schoolSlug: metadata.schoolSlug,
    folder: metadata.folder,
  };
}

export const ourFileRouter = {
  studentAvatar: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .input(RouteInput)
    .middleware(async ({ files, input }) =>
      buildMetadata("students/avatars", files, input?.schoolId)
    )
    .onUploadComplete(async ({ metadata, file }) =>
      buildUploadResponse(metadata, file)
    ),

  teacherAvatar: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .input(RouteInput)
    .middleware(async ({ files, input }) =>
      buildMetadata("teachers/avatars", files, input?.schoolId)
    )
    .onUploadComplete(async ({ metadata, file }) =>
      buildUploadResponse(metadata, file)
    ),

  parentAvatar: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .input(RouteInput)
    .middleware(async ({ files, input }) =>
      buildMetadata("parents/avatars", files, input?.schoolId)
    )
    .onUploadComplete(async ({ metadata, file }) =>
      buildUploadResponse(metadata, file)
    ),

  schoolAdminAvatar: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .input(RouteInput)
    .middleware(async ({ files, input }) =>
      buildMetadata("school-admins/avatars", files, input?.schoolId)
    )
    .onUploadComplete(async ({ metadata, file }) =>
      buildUploadResponse(metadata, file)
    ),

  staffAvatar: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .input(RouteInput)
    .middleware(async ({ files, input }) =>
      buildMetadata("staff/avatars", files, input?.schoolId)
    )
    .onUploadComplete(async ({ metadata, file }) =>
      buildUploadResponse(metadata, file)
    ),

  bursarAvatar: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .input(RouteInput)
    .middleware(async ({ files, input }) =>
      buildMetadata("bursars/avatars", files, input?.schoolId)
    )
    .onUploadComplete(async ({ metadata, file }) =>
      buildUploadResponse(metadata, file)
    ),

  schoolBrandImage: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .input(RouteInput)
    .middleware(async ({ files, input }) => {
      const metadata = await buildMetadata("school/branding", files, input?.schoolId);
      if (
        metadata.role !== "school_admin" &&
        metadata.role !== "platform_admin"
      ) {
        throw new Error("Only school admins can upload school branding");
      }
      return metadata;
    })
    .onUploadComplete(async ({ metadata, file }) =>
      buildUploadResponse(metadata, file)
    ),

  libraryBookCover: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .input(RouteInput)
    .middleware(async ({ files, input }) => {
      const metadata = await buildMetadata("library/covers", files, input?.schoolId);
      await connectToDatabase();
      const ok = await canUploadLibraryBookCover({
        schoolId: new mongoose.Types.ObjectId(metadata.schoolId),
        userId: new mongoose.Types.ObjectId(metadata.userId),
        role: metadata.role,
      });
      if (!ok) {
        throw new Error("Not allowed to upload library covers for this school");
      }
      return metadata;
    })
    .onUploadComplete(async ({ metadata, file }) =>
      buildUploadResponse(metadata, file)
    ),

  teacherDocument: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 1 },
    image: { maxFileSize: "8MB", maxFileCount: 1 },
    video: { maxFileSize: "64MB", maxFileCount: 1 },
    "text/csv": { maxFileSize: "8MB", maxFileCount: 1 },
    "application/vnd.ms-excel": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      maxFileSize: "16MB",
      maxFileCount: 1,
    },
    "application/vnd.ms-powerpoint": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
      maxFileSize: "16MB",
      maxFileCount: 1,
    },
    "application/msword": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      {
        maxFileSize: "16MB",
        maxFileCount: 1,
      },
  })
    .input(RouteInput)
    .middleware(async ({ files, input }) =>
      buildMetadata("documents/teachers", files, input?.schoolId)
    )
    .onUploadComplete(async ({ metadata, file }) =>
      buildUploadResponse(metadata, file)
    ),

  studentRecordDocument: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 1 },
    image: { maxFileSize: "8MB", maxFileCount: 1 },
    video: { maxFileSize: "64MB", maxFileCount: 1 },
    "text/csv": { maxFileSize: "8MB", maxFileCount: 1 },
    "application/vnd.ms-excel": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      maxFileSize: "16MB",
      maxFileCount: 1,
    },
    "application/vnd.ms-powerpoint": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
      maxFileSize: "16MB",
      maxFileCount: 1,
    },
    "application/msword": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      {
        maxFileSize: "16MB",
        maxFileCount: 1,
      },
  })
    .input(RouteInput)
    .middleware(async ({ files, input }) =>
      buildMetadata("documents/students", files, input?.schoolId)
    )
    .onUploadComplete(async ({ metadata, file }) =>
      buildUploadResponse(metadata, file)
    ),

  expenseReceipt: f({
    pdf: { maxFileSize: "8MB", maxFileCount: 1 },
    image: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .input(RouteInput)
    .middleware(async ({ files, input }) =>
      buildMetadata("documents/expenses", files, input?.schoolId)
    )
    .onUploadComplete(async ({ metadata, file }) =>
      buildUploadResponse(metadata, file)
    ),

  assignmentAttachment: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 1 },
    image: { maxFileSize: "8MB", maxFileCount: 1 },
    "text/csv": { maxFileSize: "8MB", maxFileCount: 1 },
    "application/vnd.ms-excel": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      maxFileSize: "16MB",
      maxFileCount: 1,
    },
    "application/msword": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      {
        maxFileSize: "16MB",
        maxFileCount: 1,
      },
  })
    .input(RouteInput)
    .middleware(async ({ files, input }) =>
      buildMetadata("assignments/attachments", files, input?.schoolId)
    )
    .onUploadComplete(async ({ metadata, file }) =>
      buildUploadResponse(metadata, file)
    ),

  submissionAttachment: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 1 },
    image: { maxFileSize: "8MB", maxFileCount: 1 },
    "text/csv": { maxFileSize: "8MB", maxFileCount: 1 },
    "application/vnd.ms-excel": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      maxFileSize: "16MB",
      maxFileCount: 1,
    },
    "application/msword": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      {
        maxFileSize: "16MB",
        maxFileCount: 1,
      },
  })
    .input(RouteInput)
    .middleware(async ({ files, input }) =>
      buildMetadata("submissions/attachments", files, input?.schoolId)
    )
    .onUploadComplete(async ({ metadata, file }) =>
      buildUploadResponse(metadata, file)
    ),

  noticeAttachment: f({
    pdf: { maxFileSize: "8MB", maxFileCount: 1 },
    image: { maxFileSize: "8MB", maxFileCount: 1 },
    "application/msword": { maxFileSize: "8MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      {
        maxFileSize: "8MB",
        maxFileCount: 1,
      },
  })
    .input(RouteInput)
    .middleware(async ({ files, input }) =>
      buildMetadata("notices", files, input?.schoolId)
    )
    .onUploadComplete(async ({ metadata, file }) =>
      buildUploadResponse(metadata, file)
    ),

  // ─── Public admissions document upload ──────────────────────────────────
  // Used by the unauthenticated /apply/* page and tracker. We accept either
  // a tracker token (existing application) OR (schoolId, cycleSlug) so an
  // applicant can attach files _before_ submitting. We refuse any upload that
  // can't be tied back to a published cycle to prevent abuse of the route.
  admissionDocument: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 1 },
    image: { maxFileSize: "8MB", maxFileCount: 1 },
    "application/msword": { maxFileSize: "16MB", maxFileCount: 1 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      {
        maxFileSize: "16MB",
        maxFileCount: 1,
      },
  })
    .input(PublicAdmissionInput)
    .middleware(async ({ files, input }) => {
      enforceDemoPolicy("uploadthing", "upload");
      await connectToDatabase();

      let resolvedSchoolId: string | null = null;
      let folder = "admissions/documents";

      if (input.supplementalRequestToken) {
        const app = await AdmissionApplication.findOne({
          supplementalDocumentRequests: {
            $elemMatch: {
              token: input.supplementalRequestToken,
              fulfilledAt: null,
            },
          },
        })
          .select({ schoolId: 1, status: 1 })
          .lean();
        if (!app) throw new Error("Invalid or completed document request");
        if (
          app.status === "accepted" ||
          app.status === "rejected" ||
          app.status === "withdrawn" ||
          app.status === "expired"
        ) {
          throw new Error("This application is no longer accepting documents");
        }
        resolvedSchoolId = String(app.schoolId);
      } else if (input.studentParentDocumentToken) {
        const stu = await Student.findOne({
          parentDocumentRequests: {
            $elemMatch: {
              token: input.studentParentDocumentToken,
              fulfilledAt: null,
            },
          },
        })
          .select({ schoolId: 1 })
          .lean();
        if (!stu) throw new Error("Invalid or completed document request");
        resolvedSchoolId = String(stu.schoolId);
        folder = "students/parent-documents";
      } else if (input.applicantToken) {
        const app = await AdmissionApplication.findOne({
          "tracker.token": input.applicantToken,
        })
          .select({ schoolId: 1, cycleId: 1, status: 1 })
          .lean();
        if (!app) throw new Error("Invalid application token");
        resolvedSchoolId = String(app.schoolId);
      } else if (input.schoolId && input.cycleSlug) {
        const cycle = await AdmissionCycle.findOne({
          schoolId: input.schoolId,
          slug: input.cycleSlug,
        })
          .select({ schoolId: 1, status: 1 })
          .lean();
        if (!cycle) throw new Error("Cycle not found");
        if (cycle.status !== "published") {
          throw new Error("Cycle is not accepting applications");
        }
        resolvedSchoolId = String(cycle.schoolId);
      } else {
        throw new Error("Missing token or cycle reference");
      }

      const school = await School.findById(resolvedSchoolId)
        .select("name")
        .lean<{ name?: string }>();
      const schoolSlug = slugify(school?.name || resolvedSchoolId || "school");
      const incomingBytes = files.reduce(
        (sum, f) => sum + Math.max(0, Number(f.size || 0)),
        0
      );
      const storageLimit = await checkUsageLimit({
        schoolId: resolvedSchoolId,
        limitKey: "maxStorageBytes",
        increment: incomingBytes,
        expensive: true,
      });
      if (!storageLimit.allowed) {
        throw new Error("Storage limit reached for this school.");
      }

      const timestamp = Date.now();
      const filesWithCustomIds = files.map((file, index) => ({
        ...file,
        customId:
          `${schoolSlug}/${folder}/${timestamp}-${index}-${sanitizeFileName(file.name)}`.slice(
            0,
            220
          ),
      }));

      return {
        userId: "public",
        schoolId: resolvedSchoolId,
        schoolSlug,
        folder,
        [UTFiles]: filesWithCustomIds,
      };
    })
    .onUploadComplete(async ({ metadata, file }) =>
      buildUploadResponse(metadata, file)
    ),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
