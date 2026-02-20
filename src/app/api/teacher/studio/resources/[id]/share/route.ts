import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { requireTeacherStudioAccess } from "@/lib/features/teacherStudio";
import { PERMISSIONS } from "@/lib/rbac";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { TeacherResource } from "@/models/TeacherResource";
import { User } from "@/models/User";

const ShareSchema = z.object({
  targetType: z.enum(["teacher", "student", "parent"]),
  targetId: z.string().min(1),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function buildDisplayName(value: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) {
  if (value.name?.trim()) return value.name.trim();
  const combined = [value.firstName, value.lastName].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  return value.email || "Unknown";
}

type ParentShareTargetLean = {
  _id: mongoose.Types.ObjectId;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

type TeacherShareTargetLean = {
  _id: mongoose.Types.ObjectId;
  userId?:
    | {
        name?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        email?: string | null;
        avatarUrl?: string | null;
      }
    | null;
};

type StudentShareTargetLean = {
  _id: mongoose.Types.ObjectId;
  firstName?: string | null;
  lastName?: string | null;
  admissionNo?: string | null;
  photoUrl?: string | null;
};

async function resolveTarget(params: {
  targetType: "teacher" | "student" | "parent";
  targetId: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  currentTeacherId: mongoose.Types.ObjectId;
}) {
  const { targetType, targetId, schoolId, currentTeacherId } = params;

  if (targetType === "teacher") {
    const teacher = await Teacher.findOne({
      _id: targetId,
      schoolId,
      status: "active",
    })
      .populate("userId", "name firstName lastName email avatarUrl")
      .select("_id userId")
      .lean<TeacherShareTargetLean | null>();

    if (!teacher || String(teacher._id) === String(currentTeacherId)) return null;

    const user = teacher.userId || undefined;

    return {
      targetType,
      targetId: teacher._id,
      targetName: buildDisplayName(user || {}),
      targetAvatarUrl: user?.avatarUrl || null,
      targetSubtitle: "Teacher",
      sharedAt: new Date(),
    };
  }

  if (targetType === "student") {
    const student = await Student.findOne({
      _id: targetId,
      schoolId,
      status: "active",
    })
      .select("_id firstName lastName admissionNo photoUrl")
      .lean<StudentShareTargetLean | null>();

    if (!student) return null;

    return {
      targetType,
      targetId: student._id,
      targetName: [student.firstName, student.lastName].filter(Boolean).join(" "),
      targetAvatarUrl: student.photoUrl || null,
      targetSubtitle: student.admissionNo ? `Admission ${student.admissionNo}` : "Student",
      sharedAt: new Date(),
    };
  }

  const parent = await User.findOne({
    _id: targetId,
    schoolId,
    role: "parent",
  })
    .select("_id name firstName lastName email avatarUrl")
    .lean<ParentShareTargetLean | null>();

  if (!parent) return null;

  return {
    targetType,
    targetId: parent._id,
    targetName: buildDisplayName(parent),
    targetAvatarUrl: parent.avatarUrl || null,
    targetSubtitle: parent.email || "Parent",
    sharedAt: new Date(),
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.resourcesView);

    const { id } = await params;
    const resourceId = toObjectIdOrNull(id);
    if (!resourceId) {
      return Response.json({ success: false, error: "Invalid resource ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = ShareSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const targetObjId = toObjectIdOrNull(parsed.data.targetId);
    if (!targetObjId) {
      return Response.json({ success: false, error: "Invalid target ID" }, { status: 400 });
    }

    const resource = await TeacherResource.findOne({
      _id: resourceId,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
    })
      .select("_id sharedWith")
      .lean() as
      | {
          _id: mongoose.Types.ObjectId;
          sharedWith?: Array<{
            targetType: "teacher" | "student" | "parent";
            targetId: mongoose.Types.ObjectId;
          }>;
        }
      | null;

    if (!resource) {
      return Response.json({ success: false, error: "Resource not found" }, { status: 404 });
    }

    const exists = (resource.sharedWith || []).some(
      (entry) =>
        entry.targetType === parsed.data.targetType &&
        String(entry.targetId) === String(targetObjId)
    );
    if (exists) {
      return Response.json({ success: true, data: { alreadyShared: true } });
    }

    const entry = await resolveTarget({
      targetType: parsed.data.targetType,
      targetId: targetObjId,
      schoolId: context.schoolId,
      currentTeacherId: context.teacherId,
    });

    if (!entry) {
      return Response.json({ success: false, error: "Share target not found" }, { status: 404 });
    }

    await TeacherResource.updateOne(
      { _id: resourceId, schoolId: context.schoolId, teacherId: context.teacherId },
      { $push: { sharedWith: entry } }
    );

    return Response.json({ success: true, data: { shared: true } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to share resource:", e);
    const message = e instanceof Error ? e.message : "Failed to share resource";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.resourcesView);

    const { id } = await params;
    const resourceId = toObjectIdOrNull(id);
    if (!resourceId) {
      return Response.json({ success: false, error: "Invalid resource ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = ShareSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const targetObjId = toObjectIdOrNull(parsed.data.targetId);
    if (!targetObjId) {
      return Response.json({ success: false, error: "Invalid target ID" }, { status: 400 });
    }

    await TeacherResource.updateOne(
      {
        _id: resourceId,
        schoolId: context.schoolId,
        teacherId: context.teacherId,
      },
      {
        $pull: {
          sharedWith: {
            targetType: parsed.data.targetType,
            targetId: targetObjId,
          },
        },
      }
    );

    return Response.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to unshare resource:", e);
    const message = e instanceof Error ? e.message : "Failed to unshare resource";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
