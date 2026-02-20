import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { requireTeacherStudioAccess } from "@/lib/features/teacherStudio";
import { PERMISSIONS } from "@/lib/rbac";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { TeacherResource } from "@/models/TeacherResource";

const UpdateResourceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  url: z.string().min(1).max(1000).optional(),
  type: z.enum(["link", "pdf", "video", "image", "doc", "slides", "other"]).optional(),
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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const { id } = await params;
    await requireTeacherStudioAccess(context, PERMISSIONS.resourcesView);

    const resourceId = toObjectIdOrNull(id);
    if (!resourceId) {
      return Response.json({ success: false, error: "Invalid resource ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = UpdateResourceSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const current = await TeacherResource.findOne({
      _id: resourceId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("subjectId classGroupIds")
      .lean() as {
      subjectId?: mongoose.Types.ObjectId | null;
      classGroupIds?: mongoose.Types.ObjectId[];
    } | null;

    if (!current) {
      return Response.json({ success: false, error: "Resource not found" }, { status: 404 });
    }

    const nextSubjectId =
      parsed.data.subjectId !== undefined
        ? parsed.data.subjectId
          ? toObjectIdOrNull(parsed.data.subjectId)
          : null
        : current.subjectId || null;

    if (parsed.data.subjectId && !nextSubjectId) {
      return Response.json({ success: false, error: "Invalid subject" }, { status: 400 });
    }

    const nextClassGroupIds =
      parsed.data.classGroupIds !== undefined
        ? (parsed.data.classGroupIds
            .map((value) => toObjectIdOrNull(value))
            .filter(Boolean) as mongoose.Types.ObjectId[])
        : current.classGroupIds || [];

    await ensureTeacherResourceScope({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      subjectId: nextSubjectId,
      classGroupIds: nextClassGroupIds,
    });

    const updateData: Record<string, unknown> = {};
    const unsetData: Record<string, unknown> = {};

    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.url !== undefined) updateData.url = parsed.data.url;
    if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
    if (parsed.data.tags !== undefined) updateData.tags = parsed.data.tags;

    if (parsed.data.subjectId !== undefined) {
      if (nextSubjectId) {
        updateData.subjectId = nextSubjectId;
      } else {
        unsetData.subjectId = "";
      }
    }

    if (parsed.data.classGroupIds !== undefined) {
      updateData.classGroupIds = nextClassGroupIds;
    }

    if ("description" in parsed.data) {
      if (parsed.data.description) {
        updateData.description = parsed.data.description;
      } else {
        unsetData.description = "";
      }
    }

    const updatePayload: Record<string, unknown> = { $set: updateData };
    if (Object.keys(unsetData).length > 0) {
      updatePayload.$unset = unsetData;
    }

    const result = await TeacherResource.updateOne(
      { _id: resourceId, schoolId: context.schoolId, teacherId: context.teacherId },
      updatePayload
    );

    if (!result.matchedCount) {
      return Response.json({ success: false, error: "Resource not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update resource:", e);
    const message = e instanceof Error ? e.message : "Failed to update resource";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const { id } = await params;
    await requireTeacherStudioAccess(context, PERMISSIONS.resourcesView);

    const resourceId = toObjectIdOrNull(id);
    if (!resourceId) {
      return Response.json({ success: false, error: "Invalid resource ID" }, { status: 400 });
    }

    const result = await TeacherResource.deleteOne({
      _id: resourceId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    });

    if (!result.deletedCount) {
      return Response.json({ success: false, error: "Resource not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to delete resource:", e);
    const message = e instanceof Error ? e.message : "Failed to delete resource";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
