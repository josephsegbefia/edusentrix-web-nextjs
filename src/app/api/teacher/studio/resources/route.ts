import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { requireTeacherStudioAccess } from "@/lib/features/teacherStudio";
import { PERMISSIONS } from "@/lib/rbac";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { TeacherResource } from "@/models/TeacherResource";

const ResourceSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  url: z.string().min(1).max(1000),
  type: z.enum(["link", "pdf", "video", "image", "doc", "slides", "other"]).default("link"),
  tags: z.array(z.string().max(40)).optional(),
  subjectId: z.string().min(1).optional().nullable(),
  classGroupIds: z.array(z.string().min(1)).optional(),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

async function ensureTeacherResourceScope(params: {
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId | null;
  classGroupIds?: mongoose.Types.ObjectId[];
}) {
  const { schoolId, teacherId, subjectId, classGroupIds = [] } = params;
  if (!subjectId && classGroupIds.length === 0) return;

  const assignments = await TeacherAssignment.find({
    schoolId,
    teacherId,
    status: "active",
  })
    .select("subjectId classGroupId")
    .lean();

  const allowedSubjectIds = new Set(assignments.map((item) => String(item.subjectId)));
  const allowedClassGroupIds = new Set(assignments.map((item) => String(item.classGroupId)));
  const pairKeys = new Set(
    assignments.map((item) => `${String(item.classGroupId)}:${String(item.subjectId)}`)
  );

  if (subjectId && !allowedSubjectIds.has(String(subjectId))) {
    throw Response.json({ success: false, error: "Forbidden subject selection" }, { status: 403 });
  }

  const disallowedClassIds = classGroupIds.filter(
    (classGroupId) => !allowedClassGroupIds.has(String(classGroupId))
  );
  if (disallowedClassIds.length > 0) {
    throw Response.json({ success: false, error: "Forbidden class selection" }, { status: 403 });
  }

  if (subjectId && classGroupIds.length > 0) {
    const invalidPairs = classGroupIds.filter(
      (classGroupId) => !pairKeys.has(`${String(classGroupId)}:${String(subjectId)}`)
    );
    if (invalidPairs.length > 0) {
      throw Response.json(
        { success: false, error: "Selected classes are not assigned for this subject" },
        { status: 403 }
      );
    }
  }
}

type SubjectLean = {
  _id?: mongoose.Types.ObjectId;
  name: string;
};

type ClassGroupLean = {
  _id?: mongoose.Types.ObjectId;
  name: string;
};

function isPopulatedSubject(value: unknown): value is SubjectLean {
  return Boolean(value && typeof value === "object" && "name" in value);
}

function isPopulatedClassGroup(value: unknown): value is ClassGroupLean {
  return Boolean(value && typeof value === "object" && "name" in value);
}

function mapResource(resource: {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string | null;
  url: string;
  type: "link" | "pdf" | "video" | "image" | "doc" | "slides" | "other";
  tags?: string[];
  subjectId?: mongoose.Types.ObjectId | SubjectLean | null;
  classGroupIds?: Array<mongoose.Types.ObjectId | ClassGroupLean>;
  sharedWith?: Array<{
    targetType: "teacher" | "student" | "parent";
    targetId: mongoose.Types.ObjectId;
    targetName: string;
    targetAvatarUrl?: string | null;
    targetSubtitle?: string | null;
    sharedAt?: Date | null;
  }>;
  createdAt?: Date | null;
}) {
  return {
    id: String(resource._id),
    title: resource.title,
    description: resource.description || null,
    url: resource.url,
    type: resource.type,
    tags: resource.tags || [],
    subject: isPopulatedSubject(resource.subjectId)
      ? {
          id: String(resource.subjectId._id || resource.subjectId),
          name: resource.subjectId.name,
        }
      : null,
    classGroups: (resource.classGroupIds || [])
      .map((classGroup) => {
        if (!isPopulatedClassGroup(classGroup)) return null;
        return {
          id: String(classGroup._id || classGroup),
          name: classGroup.name,
        };
      })
      .filter(Boolean),
    sharedWith: (resource.sharedWith || []).map((entry) => ({
      targetType: entry.targetType,
      targetId: String(entry.targetId),
      targetName: entry.targetName,
      targetAvatarUrl: entry.targetAvatarUrl || null,
      targetSubtitle: entry.targetSubtitle || null,
      sharedAt: entry.sharedAt ? entry.sharedAt.toISOString() : null,
    })),
    createdAt: resource.createdAt ? resource.createdAt.toISOString() : null,
  };
}

type ResourceMapInput = Parameters<typeof mapResource>[0];

export async function GET(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.resourcesView);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const type = searchParams.get("type");
    const tag = searchParams.get("tag");
    const subjectId = searchParams.get("subjectId");
    const classGroupId = searchParams.get("classGroupId");
    const limitParam = searchParams.get("limit");
    const parsedLimit = limitParam ? Number(limitParam) : 100;
    const limit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(500, parsedLimit))
      : 100;

    const query: Record<string, unknown> = {
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    };

    if (type && type !== "all") query.type = type;
    if (tag) query.tags = tag;
    if (subjectId) {
      const subjectObj = toObjectIdOrNull(subjectId);
      if (subjectObj) query.subjectId = subjectObj;
    }
    if (classGroupId) {
      const classGroupObj = toObjectIdOrNull(classGroupId);
      if (classGroupObj) query.classGroupIds = classGroupObj;
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const resources = await TeacherResource.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("subjectId", "name")
      .populate("classGroupIds", "name")
      .lean();

    return Response.json({
      success: true,
      data: {
        resources: resources.map((resource) => mapResource(resource)),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load resources:", e);
    const message = e instanceof Error ? e.message : "Failed to load resources";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.resourcesView);

    const body = await req.json().catch(() => null);
    const parsed = ResourceSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const subjectId = parsed.data.subjectId
      ? toObjectIdOrNull(parsed.data.subjectId)
      : null;
    if (parsed.data.subjectId && !subjectId) {
      return Response.json({ success: false, error: "Invalid subject" }, { status: 400 });
    }

    const classGroupIds = (parsed.data.classGroupIds || [])
      .map((id) => toObjectIdOrNull(id))
      .filter(Boolean) as mongoose.Types.ObjectId[];

    await ensureTeacherResourceScope({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      subjectId,
      classGroupIds,
    });

    const resource = await TeacherResource.create({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      title: parsed.data.title,
      description: parsed.data.description || undefined,
      url: parsed.data.url,
      type: parsed.data.type,
      tags: parsed.data.tags || [],
      subjectId: subjectId || undefined,
      classGroupIds,
      sharedWith: [],
    });

    const hydrated = await TeacherResource.findById(resource._id)
      .populate("subjectId", "name")
      .populate("classGroupIds", "name")
      .lean();

    return Response.json({
      success: true,
      data: {
        resource: hydrated
          ? mapResource(hydrated as unknown as ResourceMapInput)
          : { id: String(resource._id) },
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to create resource:", e);
    const message = e instanceof Error ? e.message : "Failed to create resource";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
