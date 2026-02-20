import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { requireTeacherStudioAccess } from "@/lib/features/teacherStudio";
import { PERMISSIONS } from "@/lib/rbac";
import { Guardian } from "@/models/Guardian";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { User } from "@/models/User";

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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type ParentTargetLean = {
  _id: mongoose.Types.ObjectId;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

export async function GET(req: Request) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    await requireTeacherStudioAccess(context, PERMISSIONS.resourcesView);

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const query = (searchParams.get("q") || "").trim();
    const classGroupId = searchParams.get("classGroupId");
    const limitParam = Number(searchParams.get("limit") || 20);
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(50, limitParam))
      : 20;

    if (!type || !["teacher", "student", "parent"].includes(type)) {
      return Response.json({ success: false, error: "Invalid share target type" }, { status: 400 });
    }

    const classGroupObjId = classGroupId ? toObjectIdOrNull(classGroupId) : null;
    const nameRegex = query ? new RegExp(escapeRegExp(query), "i") : null;

    if (type === "teacher") {
      let teacherIdsForClass: Set<string> | null = null;
      if (classGroupObjId) {
        const assignments = await TeacherAssignment.find({
          schoolId: context.schoolId,
          classGroupId: classGroupObjId,
          status: "active",
        })
          .select("teacherId")
          .lean();
        teacherIdsForClass = new Set(assignments.map((item) => String(item.teacherId)));
      }

      const teachers = await Teacher.find({
        schoolId: context.schoolId,
        status: "active",
        _id: { $ne: context.teacherId },
      })
        .populate("userId", "name firstName lastName email avatarUrl")
        .select("_id userId")
        .lean();

      const targets = teachers
        .filter((teacher) => !teacherIdsForClass || teacherIdsForClass.has(String(teacher._id)))
        .map((teacher) => {
          const user = teacher.userId as
            | {
                _id?: mongoose.Types.ObjectId;
                name?: string;
                firstName?: string;
                lastName?: string;
                email?: string;
                avatarUrl?: string;
              }
            | undefined;
          const name = buildDisplayName({
            name: user?.name,
            firstName: user?.firstName,
            lastName: user?.lastName,
            email: user?.email,
          });
          return {
            id: String(teacher._id),
            type: "teacher" as const,
            name,
            avatarUrl: user?.avatarUrl || null,
            subtitle: "Teacher",
          };
        })
        .filter((target) => !nameRegex || nameRegex.test(`${target.name} ${target.subtitle}`))
        .slice(0, limit);

      return Response.json({ success: true, data: { targets } });
    }

    if (type === "student") {
      const studentQuery: Record<string, unknown> = {
        schoolId: context.schoolId,
        status: "active",
      };

      if (classGroupObjId) {
        studentQuery.classGroupId = classGroupObjId;
      }
      if (nameRegex) {
        studentQuery.$or = [
          { firstName: { $regex: nameRegex } },
          { lastName: { $regex: nameRegex } },
          { middleName: { $regex: nameRegex } },
          { admissionNo: { $regex: nameRegex } },
        ];
      }

      const students = await Student.find(studentQuery)
        .select("_id firstName lastName middleName admissionNo photoUrl")
        .limit(limit)
        .lean();

      const targets = students.map((student) => ({
        id: String(student._id),
        type: "student" as const,
        name: [student.firstName, student.lastName].filter(Boolean).join(" "),
        avatarUrl: student.photoUrl || null,
        subtitle: student.admissionNo ? `Admission ${student.admissionNo}` : "Student",
      }));

      return Response.json({ success: true, data: { targets } });
    }

    let userIdsForClass: Set<string> | null = null;
    if (classGroupObjId) {
      const studentIds = (
        await Student.find({
          schoolId: context.schoolId,
          classGroupId: classGroupObjId,
          status: "active",
        })
          .select("_id")
          .lean()
      ).map((item) => item._id);

      if (studentIds.length === 0) {
        return Response.json({ success: true, data: { targets: [] } });
      }

      const guardians = await Guardian.find({
        studentId: { $in: studentIds },
      })
        .select("userId")
        .lean();
      userIdsForClass = new Set(guardians.map((item) => String(item.userId)));
    }

    const userQuery: Record<string, unknown> = {
      schoolId: context.schoolId,
      role: "parent",
    };

    if (userIdsForClass) {
      userQuery._id = { $in: Array.from(userIdsForClass).map((id) => new mongoose.Types.ObjectId(id)) };
    }

    if (nameRegex) {
      userQuery.$or = [
        { name: { $regex: nameRegex } },
        { firstName: { $regex: nameRegex } },
        { lastName: { $regex: nameRegex } },
        { email: { $regex: nameRegex } },
      ];
    }

    const parents = await User.find(userQuery)
      .select("_id name firstName lastName email avatarUrl")
      .limit(limit)
      .lean<ParentTargetLean[]>();

    const targets = parents.map((parent) => ({
      id: String(parent._id),
      type: "parent" as const,
      name: buildDisplayName(parent),
      avatarUrl: parent.avatarUrl || null,
      subtitle: parent.email || "Parent",
    }));

    return Response.json({ success: true, data: { targets } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to search resource share targets:", e);
    const message = e instanceof Error ? e.message : "Failed to search targets";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
