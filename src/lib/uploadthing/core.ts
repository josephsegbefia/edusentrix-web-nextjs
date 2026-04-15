import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { User } from "@/models/User";
import { createUploadthing, type FileRouter, UTFiles } from "uploadthing/next";
import { z } from "zod";
import { checkLimit } from "@/lib/billing/entitlements";
import { trackUsage } from "@/lib/billing/trackUsage";

const f = createUploadthing();
const RouteInput = z.object({
  schoolId: z.string().trim().min(1).optional(),
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

  const storageLimit = await checkLimit(
    context.schoolId,
    "maxStorageBytes",
    incomingBytes
  );
  if (!storageLimit.allowed) {
    throw new Error("Storage limit reached for this subscription.");
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
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
