import "server-only";
import mongoose from "mongoose";
import type { Model } from "mongoose";
import { clerkClient } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { deleteUploadedFiles } from "@/lib/uploads/delete";
import { detectUploadProvider } from "@/lib/uploads/provider";
import {
  deleteOrderedCollections,
  type CollectionRegistryEntry,
} from "@/lib/demo/collection-registry";
import { School } from "@/models/School";
import { User } from "@/models/User";
import { Student } from "@/models/Student";
import { Guardian } from "@/models/Guardian";

/**
 * School-scoped models not yet listed in the demo collection registry. Merged
 * at purge time so a full school delete does not leave orphan platform data.
 */
const EXTRA_PURGE: CollectionRegistryEntry[] = [
  { modelName: "CurriculumNode", schoolIdField: "schoolId", deleteOrder: 11, seedOrder: 99, description: "purge" },
  { modelName: "CurriculumSubject", schoolIdField: "schoolId", deleteOrder: 12, seedOrder: 99, description: "purge" },
  { modelName: "Curriculum", schoolIdField: "schoolId", deleteOrder: 13, seedOrder: 99, description: "purge" },
  { modelName: "SchemeReview", schoolIdField: "schoolId", deleteOrder: 5, seedOrder: 99, description: "purge" },
  { modelName: "SchemeItem", schoolIdField: "schoolId", deleteOrder: 5, seedOrder: 99, description: "purge" },
  { modelName: "SchemeImportJob", schoolIdField: "schoolId", deleteOrder: 6, seedOrder: 99, description: "purge" },
  { modelName: "SchemeOfWork", schoolIdField: "schoolId", deleteOrder: 7, seedOrder: 99, description: "purge" },
  { modelName: "LibraryLoan", schoolIdField: "schoolId", deleteOrder: 6, seedOrder: 99, description: "purge" },
  { modelName: "LibraryReservation", schoolIdField: "schoolId", deleteOrder: 6, seedOrder: 99, description: "purge" },
  { modelName: "LibraryBookCopy", schoolIdField: "schoolId", deleteOrder: 10, seedOrder: 99, description: "purge" },
  { modelName: "LibraryBook", schoolIdField: "schoolId", deleteOrder: 11, seedOrder: 99, description: "purge" },
  { modelName: "LibraryNotice", schoolIdField: "schoolId", deleteOrder: 8, seedOrder: 99, description: "purge" },
  { modelName: "LibraryImportJob", schoolIdField: "schoolId", deleteOrder: 8, seedOrder: 99, description: "purge" },
  { modelName: "LibrarySettings", schoolIdField: "schoolId", deleteOrder: 14, seedOrder: 99, description: "purge" },
  { modelName: "AdmissionEvent", schoolIdField: "schoolId", deleteOrder: 3, seedOrder: 99, description: "purge" },
  { modelName: "AdmissionApplication", schoolIdField: "schoolId", deleteOrder: 4, seedOrder: 99, description: "purge" },
  { modelName: "AdmissionInviteLink", schoolIdField: "schoolId", deleteOrder: 4, seedOrder: 99, description: "purge" },
  { modelName: "AdmissionForm", schoolIdField: "schoolId", deleteOrder: 5, seedOrder: 99, description: "purge" },
  { modelName: "AdmissionCycle", schoolIdField: "schoolId", deleteOrder: 6, seedOrder: 99, description: "purge" },
  { modelName: "Delegation", schoolIdField: "schoolId", deleteOrder: 8, seedOrder: 99, description: "purge" },
  { modelName: "InternalTestGeneratedRecord", schoolIdField: "schoolId", deleteOrder: 0, seedOrder: 99, description: "purge" },
  { modelName: "InternalTestSchoolConfig", schoolIdField: "schoolId", deleteOrder: 0, seedOrder: 99, description: "purge" },
  { modelName: "InternalTestDataGenerationJob", schoolIdField: "schoolId", deleteOrder: 0, seedOrder: 99, description: "purge" },
  { modelName: "LeoConversation", schoolIdField: "schoolId", deleteOrder: 1, seedOrder: 99, description: "purge" },
  { modelName: "MeetingProviderEvent", schoolIdField: "schoolId", deleteOrder: 2, seedOrder: 99, description: "purge" },
  { modelName: "Meeting", schoolIdField: "schoolId", deleteOrder: 3, seedOrder: 99, description: "purge" },
  { modelName: "StoreProduct", schoolIdField: "schoolId", deleteOrder: 8, seedOrder: 99, description: "purge" },
  { modelName: "PilotCloseoutRun", schoolIdField: "schoolId", deleteOrder: 5, seedOrder: 99, description: "purge" },
  { modelName: "SubscriptionEvent", schoolIdField: "schoolId", deleteOrder: 1, seedOrder: 99, description: "purge" },
  { modelName: "SchoolUnallocatedGapFill", schoolIdField: "schoolId", deleteOrder: 8, seedOrder: 99, description: "purge" },
  { modelName: "PollTemplate", schoolIdField: "schoolId", deleteOrder: 8, seedOrder: 99, description: "purge" },
];

function mergePurgeRegistry(): CollectionRegistryEntry[] {
  const map = new Map<string, CollectionRegistryEntry>();
  for (const e of deleteOrderedCollections()) {
    map.set(e.modelName, e);
  }
  for (const e of EXTRA_PURGE) {
    if (!map.has(e.modelName)) {
      map.set(e.modelName, e);
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.deleteOrder !== b.deleteOrder) return a.deleteOrder - b.deleteOrder;
    return a.modelName.localeCompare(b.modelName);
  });
}

async function loadModel(modelName: string): Promise<Model<unknown> | null> {
  try {
    const imported = (await import(`@/models/${modelName}`)) as Record<
      string,
      unknown
    >;
    const candidate = imported[modelName];
    if (
      candidate &&
      typeof candidate === "object" &&
      "deleteMany" in candidate &&
      typeof (candidate as Model<unknown>).deleteMany === "function"
    ) {
      return candidate as Model<unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function collectUploadUrls(value: unknown, out: Set<string>): void {
  if (value == null) return;
  if (typeof value === "string") {
    if (
      value.startsWith("http") &&
      detectUploadProvider(value) !== "unknown"
    ) {
      out.add(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUploadUrls(item, out);
    return;
  }
  if (typeof value === "object") {
    if (value instanceof mongoose.Types.ObjectId) return;
    if (value instanceof Date) return;
    if (Buffer.isBuffer(value)) return;
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectUploadUrls(v, out);
    }
  }
}

async function harvestSchoolUploadUrls(
  schoolId: mongoose.Types.ObjectId
): Promise<Set<string>> {
  const urls = new Set<string>();

  const school = await School.findById(schoolId).lean();
  if (school && typeof school === "object") {
    collectUploadUrls((school as { logo?: string }).logo, urls);
  }

  const users = await User.find({ schoolId }).select("avatarUrl").lean();
  for (const u of users) {
    collectUploadUrls((u as { avatarUrl?: string }).avatarUrl, urls);
  }

  const entries = mergePurgeRegistry();
  for (const entry of entries) {
    const Model = await loadModel(entry.modelName);
    if (!Model) continue;
    const filter = { [entry.schoolIdField]: schoolId };
    const cursor = Model.find(filter).lean().cursor();
    for await (const doc of cursor) {
      collectUploadUrls(doc, urls);
    }
  }

  return urls;
}

export type PurgeSchoolResult = {
  mongoSchoolDeleted: boolean;
  clerkUsersDeleted: number;
  clerkFailures: number;
  uploadFilesRemoved: number;
  uploadFailures: number;
};

export async function purgeSchoolCompletely(
  schoolId: mongoose.Types.ObjectId
): Promise<PurgeSchoolResult> {
  await connectToDatabase();

  const exists = await School.findById(schoolId).select("_id").lean();
  if (!exists) {
    throw new Error("School not found");
  }

  const urls = await harvestSchoolUploadUrls(schoolId);
  const uploadStats = await deleteUploadedFiles([...urls]);

  const users = await User.find({ schoolId })
    .select("clerkUserId")
    .lean<Array<{ clerkUserId?: string }>>();

  const clerk = await clerkClient();
  let clerkOk = 0;
  let clerkFail = 0;
  for (const u of users) {
    if (!u.clerkUserId) continue;
    try {
      await clerk.users.deleteUser(u.clerkUserId);
      clerkOk += 1;
    } catch (e) {
      clerkFail += 1;
      console.error("purgeSchoolCompletely: Clerk delete failed", e);
    }
  }

  const studentIds = await Student.find({ schoolId }).distinct("_id");
  if (studentIds.length > 0) {
    await Guardian.deleteMany({ studentId: { $in: studentIds } });
  }

  const entries = mergePurgeRegistry();
  for (const entry of entries) {
    const Model = await loadModel(entry.modelName);
    if (!Model) {
      console.warn(`purgeSchoolCompletely: skip unknown model ${entry.modelName}`);
      continue;
    }
    await Model.deleteMany({ [entry.schoolIdField]: schoolId });
  }

  await School.deleteOne({ _id: schoolId });

  return {
    mongoSchoolDeleted: true,
    clerkUsersDeleted: clerkOk,
    clerkFailures: clerkFail,
    uploadFilesRemoved: uploadStats.deleted,
    uploadFailures: uploadStats.failed,
  };
}
