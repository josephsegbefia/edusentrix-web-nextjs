/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/teachers/[id]/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import { Subject } from "@/models/Subject";
import { ClassGroup } from "@/models/ClassGroup";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Grade } from "@/models/Grade";
import { UpdateTeacherSchema } from "@/schemas/teacher";
import { logTeacherActivity } from "@/lib/teachers/logTeacherActivity";
import { createTeacherNotification } from "@/lib/teachers/teacherNotifications";
import mongoose from "mongoose";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function parseDateInput(value: string): Date | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id } = await ctx.params;
  try {
    const teacherId = String(id || "");
    const teacherObjId = toObjectIdOrNull(teacherId);
    if (!teacherObjId) {
      return Response.json({ error: "Invalid teacher id" }, { status: 400 });
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const teacherRaw = await Teacher.findOne({
      _id: teacherObjId,
      schoolId: schoolIdObj,
    })
      .populate(
        "userId",
        "firstName lastName email phone avatarUrl clerkUserId"
      )
      .populate({ path: "subjectIds", select: "name", model: Subject })
      .populate({
        path: "homeroomClassGroupId",
        select: "name",
        model: ClassGroup,
      })
      .lean();

    if (!teacherRaw) {
      return Response.json({ error: "Teacher not found" }, { status: 404 });
    }

    const t = teacherRaw as any;
    const u: any = t.userId || {};

    const createdAt = t.createdAt ? new Date(t.createdAt) : new Date();
    const updatedAt = t.updatedAt ? new Date(t.updatedAt) : createdAt;

    const today = startOfDay(new Date());
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const subjects = Array.isArray(t.subjectIds)
      ? t.subjectIds.slice(0, 50).map((s: any) => ({
          id: String(s._id),
          name: String(s.name),
        }))
      : [];

    // Assigned subjects: derive from TeacherAssignment (current period, or all if none) so profile reflects actual teaching load
    let assignedSubjects: Array<{ id: string; name: string; classGroups: string[] }> = [];
    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: schoolIdObj,
      isCurrent: true,
    })
      .select("_id")
      .lean();
    const periodFilter = currentPeriod
      ? { academicPeriodId: (currentPeriod as any)._id }
      : {};
    const assignments = await TeacherAssignment.find({
      schoolId: schoolIdObj,
      teacherId: teacherObjId,
      ...periodFilter,
      status: "active",
    })
      .populate({ path: "subjectId", select: "name", model: Subject })
      .populate({
        path: "classGroupId",
        select: "name",
        populate: { path: "gradeId", select: "name", model: Grade },
      })
      .lean();
    const bySubject = new Map<
      string,
      { id: string; name: string; classGroups: string[] }
    >();
    for (const a of assignments as any[]) {
      const subj = a.subjectId;
      const cls = a.classGroupId;
      if (!subj) continue;
      const sid = String(subj._id);
      const sname = String(subj.name);
      const classLabel = cls?.gradeId?.name
        ? `${(cls.gradeId as any).name} ${cls?.name || ""}`.trim()
        : cls?.name || "—";
      if (!bySubject.has(sid)) {
        bySubject.set(sid, { id: sid, name: sname, classGroups: [] });
      }
      const entry = bySubject.get(sid)!;
      if (classLabel && !entry.classGroups.includes(classLabel)) {
        entry.classGroups.push(classLabel);
      }
    }
    assignedSubjects = Array.from(bySubject.values());

    const homeroom = t.homeroomClassGroupId
      ? {
          id: String(t.homeroomClassGroupId._id),
          name: String(t.homeroomClassGroupId.name),
        }
      : null;

    return Response.json({
      success: true,
      data: {
        id: String(t._id),
        userId: String(u._id || t.userId),

        firstName: String(u.firstName || ""),
        lastName: String(u.lastName || ""),
        fullName: `${String(u.firstName || "")} ${String(
          u.lastName || ""
        )}`.trim(),

        email: u.email ? String(u.email) : null,
        phone: u.phone ? String(u.phone) : null,
        photoUrl: u.avatarUrl ? String(u.avatarUrl) : null,

        status: (t.status || "active") as any,

        // ✅ extra professional fields (safe defaults)
        employeeId: t.employeeId ? String(t.employeeId) : null,
        department: t.department ? String(t.department) : null,
        hireDate: t.hireDate ? new Date(t.hireDate).toISOString() : null,
        terminationDate: t.terminationDate
          ? new Date(t.terminationDate).toISOString()
          : null,
        leaveStartDate: t.leaveStartDate
          ? new Date(t.leaveStartDate).toISOString()
          : null,
        leaveEndDate: t.leaveEndDate
          ? new Date(t.leaveEndDate).toISOString()
          : null,
        leaveReason: t.leaveReason ? String(t.leaveReason) : null,

        maxClasses: typeof t.maxClasses === "number" ? t.maxClasses : null,
        maxStudents: typeof t.maxStudents === "number" ? t.maxStudents : null,

        emergencyContact: t.emergencyContact || null,
        qualifications: Array.isArray(t.qualifications) ? t.qualifications : [],

        tags: Array.isArray(t.tags) ? t.tags : [],
        notes: t.notes ? String(t.notes) : null,

        subjects,
        assignedSubjects,
        homeroom,

        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        isNew: createdAt >= sevenDaysAgo,

        hasPlatformAccount: Boolean(u.clerkUserId),
      },
    });
  } catch (e) {
    console.error("Teacher detail error:", e);
    return Response.json(
      { error: "Failed to fetch teacher detail" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/teachers/:id
 * Update teacher information (User + Teacher models)
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id } = await ctx.params;
  try {
    const teacherId = String(id || "");
    const teacherObjId = toObjectIdOrNull(teacherId);
    if (!teacherObjId) {
      return Response.json({ error: "Invalid teacher id" }, { status: 400 });
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    // Parse and validate input
    const body = await req.json();
    const parsed = UpdateTeacherSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Find teacher
    const teacher = await Teacher.findOne({
      _id: teacherObjId,
      schoolId: schoolIdObj,
    });

    if (!teacher) {
      return Response.json({ error: "Teacher not found" }, { status: 404 });
    }

    // Track what changed for activity log
    const changes: string[] = [];

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Update User fields (firstName, lastName, email, phone, photoUrl)
    // ─────────────────────────────────────────────────────────────────────────
    const userUpdates: Record<string, any> = {};

    if (input.firstName !== undefined) {
      userUpdates.firstName = input.firstName;
      changes.push("firstName");
    }
    if (input.lastName !== undefined) {
      userUpdates.lastName = input.lastName;
      changes.push("lastName");
    }
    if (input.email !== undefined) {
      const existingUser = await User.findOne({
        email: input.email.toLowerCase(),
        schoolId: schoolIdObj,
        _id: { $ne: teacher.userId },
      });
      if (existingUser) {
        return Response.json(
          {
            error:
              "This email is already in use by another user in your school",
          },
          { status: 409 }
        );
      }
      userUpdates.email = input.email.toLowerCase();
      changes.push("email");
    }
    if (input.phone !== undefined) {
      userUpdates.phone = input.phone || null;
      changes.push("phone");
    }
    if (input.photoUrl !== undefined) {
      userUpdates.photoUrl = input.photoUrl || null;
      changes.push("photoUrl");
    }

    if (Object.keys(userUpdates).length > 0) {
      await User.findByIdAndUpdate(teacher.userId, { $set: userUpdates });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Update Teacher fields
    // ─────────────────────────────────────────────────────────────────────────
    const teacherUpdates: Record<string, any> = {};

    // Status
    if (input.status !== undefined) {
      teacherUpdates.status = input.status;
      changes.push("status");

      // If terminating, set terminationDate if not provided
      if (input.status === "terminated" && !input.terminationDate) {
        teacherUpdates.terminationDate = new Date();
      }
      // If activating, clear terminationDate
      if (input.status === "active") {
        teacherUpdates.terminationDate = null;
      }
    }

    // Professional info
    if (input.employeeId !== undefined) {
      const nextEmployeeId = input.employeeId?.trim() || null;
      if (nextEmployeeId) {
        const dup = await Teacher.findOne({
          schoolId: schoolIdObj,
          employeeId: nextEmployeeId,
          _id: { $ne: teacherObjId },
        })
          .select("_id")
          .lean();
        if (dup) {
          return Response.json(
            {
              error: "Another teacher already has this employee ID",
            },
            { status: 409 }
          );
        }
      }
      teacherUpdates.employeeId = nextEmployeeId;
      changes.push("employeeId");
    }
    if (input.department !== undefined) {
      teacherUpdates.department = input.department || null;
      changes.push("department");
    }
    if (input.hireDate !== undefined) {
      teacherUpdates.hireDate = input.hireDate ? new Date(input.hireDate) : null;
      changes.push("hireDate");
    }
    if (input.terminationDate !== undefined) {
      teacherUpdates.terminationDate = input.terminationDate
        ? new Date(input.terminationDate)
        : null;
      changes.push("terminationDate");
    }

    // Capacity
    if (input.maxClasses !== undefined) {
      teacherUpdates.maxClasses = input.maxClasses;
      changes.push("maxClasses");
    }
    if (input.maxStudents !== undefined) {
      teacherUpdates.maxStudents = input.maxStudents;
      changes.push("maxStudents");
    }

    // Emergency contact
    if (input.emergencyContact !== undefined) {
      teacherUpdates.emergencyContact = input.emergencyContact || null;
      changes.push("emergencyContact");
    }

    // Qualifications
    if (input.qualifications !== undefined) {
      teacherUpdates.qualifications = input.qualifications || [];
      changes.push("qualifications");
    }

    // Subjects
    if (input.subjectIds !== undefined) {
      // Validate subjects exist and belong to school
      const validSubjectIds: mongoose.Types.ObjectId[] = [];
      for (const sid of input.subjectIds) {
        const subjectObjId = toObjectIdOrNull(sid);
        if (subjectObjId) {
          const subject = await Subject.findOne({
            _id: subjectObjId,
            schoolId: schoolIdObj,
          });
          if (subject) {
            validSubjectIds.push(subjectObjId);
          }
        }
      }
      teacherUpdates.subjectIds = validSubjectIds;
      changes.push("subjects");
    }

    // Homeroom
    if (input.homeroomClassGroupId !== undefined) {
      if (input.homeroomClassGroupId && input.homeroomClassGroupId !== "") {
        const classObjId = toObjectIdOrNull(input.homeroomClassGroupId);
        if (classObjId) {
          // Validate class exists and belongs to school
          const classGroup = await ClassGroup.findOne({
            _id: classObjId,
            schoolId: schoolIdObj,
          });
          if (!classGroup) {
            return Response.json(
              { error: "Class group not found" },
              { status: 404 }
            );
          }
          // Check if class already has a different homeroom teacher
          if (
            classGroup.homeroomTeacherId &&
            String(classGroup.homeroomTeacherId) !== String(teacher._id)
          ) {
            return Response.json(
              { error: "This class already has a homeroom teacher assigned" },
              { status: 409 }
            );
          }
          teacherUpdates.homeroomClassGroupId = classObjId;

          // Update the ClassGroup to set this teacher as homeroom
          await ClassGroup.findByIdAndUpdate(classObjId, {
            $set: { homeroomTeacherId: teacher._id },
          });
        }
      } else {
        // Removing homeroom
        if (teacher.homeroomClassGroupId) {
          // Clear the homeroom from the old class group
          await ClassGroup.findByIdAndUpdate(teacher.homeroomClassGroupId, {
            $unset: { homeroomTeacherId: 1 },
          });
        }
        teacherUpdates.homeroomClassGroupId = null;
      }
      changes.push("homeroom");
    }

    // Notes and tags
    if (input.notes !== undefined) {
      teacherUpdates.notes = input.notes || null;
      changes.push("notes");
    }
    if (input.tags !== undefined) {
      teacherUpdates.tags = input.tags || [];
      changes.push("tags");
    }

    // Apply teacher updates
    if (Object.keys(teacherUpdates).length > 0) {
      await Teacher.findByIdAndUpdate(teacherObjId, { $set: teacherUpdates });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Log activity
    // ─────────────────────────────────────────────────────────────────────────
    if (changes.length > 0) {
      await logTeacherActivity({
        teacherId: String(teacher._id),
        schoolId: schoolIdObj,
        type: "teacher.updated",
        title: "Teacher profile updated",
        description: `Updated fields: ${changes.join(", ")}`,
        metadata: { fields: changes, updatedBy: adminUserId },
        createdBy: adminUserId,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Fetch and return updated teacher
    // ─────────────────────────────────────────────────────────────────────────
    const updatedTeacher = await Teacher.findById(teacherObjId)
      .populate("userId", "firstName lastName email phone avatarUrl")
      .populate({ path: "subjectIds", select: "name", model: Subject })
      .populate({
        path: "homeroomClassGroupId",
        select: "name",
        model: ClassGroup,
      })
      .lean();

    if (!updatedTeacher) {
      return Response.json({ error: "Teacher not found" }, { status: 404 });
    }

    const t = updatedTeacher as any;
    const u: any = t.userId || {};

    const subjects = Array.isArray(t.subjectIds)
      ? t.subjectIds.map((s: any) => ({
          id: String(s._id),
          name: String(s.name),
        }))
      : [];

    const homeroom = t.homeroomClassGroupId
      ? {
          id: String(t.homeroomClassGroupId._id),
          name: String(t.homeroomClassGroupId.name),
        }
      : null;

    return Response.json({
      success: true,
      data: {
        id: String(t._id),
        userId: String(u._id || t.userId),
        firstName: String(u.firstName || ""),
        lastName: String(u.lastName || ""),
        fullName: `${String(u.firstName || "")} ${String(
          u.lastName || ""
        )}`.trim(),
        email: u.email ? String(u.email) : null,
        phone: u.phone ? String(u.phone) : null,
        photoUrl: u.avatarUrl ? String(u.avatarUrl) : null,
        status: t.status || "active",
        employeeId: t.employeeId ? String(t.employeeId) : null,
        department: t.department ? String(t.department) : null,
        hireDate: t.hireDate ? new Date(t.hireDate).toISOString() : null,
        terminationDate: t.terminationDate
          ? new Date(t.terminationDate).toISOString()
          : null,
        leaveStartDate: t.leaveStartDate
          ? new Date(t.leaveStartDate).toISOString()
          : null,
        leaveEndDate: t.leaveEndDate
          ? new Date(t.leaveEndDate).toISOString()
          : null,
        leaveReason: t.leaveReason ? String(t.leaveReason) : null,
        maxClasses: typeof t.maxClasses === "number" ? t.maxClasses : null,
        maxStudents: typeof t.maxStudents === "number" ? t.maxStudents : null,
        emergencyContact: t.emergencyContact || null,
        qualifications: Array.isArray(t.qualifications) ? t.qualifications : [],
        tags: Array.isArray(t.tags) ? t.tags : [],
        notes: t.notes ? String(t.notes) : null,
        subjects,
        homeroom,
        createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
        updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : null,
      },
    });
  } catch (e) {
    console.error("Teacher update error:", e);
    return Response.json(
      { error: "Failed to update teacher" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/teachers/:id
 * Soft delete a teacher (set status to "terminated" and set terminationDate)
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { schoolId, userId: adminUserId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { id } = await ctx.params;
  try {
    const teacherId = String(id || "");
    const teacherObjId = toObjectIdOrNull(teacherId);
    if (!teacherObjId) {
      return Response.json({ error: "Invalid teacher id" }, { status: 400 });
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    // Find teacher
    const teacher = await Teacher.findOne({
      _id: teacherObjId,
      schoolId: schoolIdObj,
    }).populate("userId", "firstName lastName email");

    if (!teacher) {
      return Response.json({ error: "Teacher not found" }, { status: 404 });
    }

    const previousStatus = teacher.status;
    const user = teacher.userId as any;
    const teacherName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Unknown";

    // Already terminated
    if (previousStatus === "terminated") {
      return Response.json({
        success: true,
        message: "Teacher is already terminated",
        data: { id: String(teacher._id), status: "terminated" },
      });
    }

    // Update teacher status to terminated
    await Teacher.findByIdAndUpdate(teacherObjId, {
      $set: {
        status: "terminated",
        terminationDate: new Date(),
      },
    });

    // Optionally: Deactivate all active assignments for this teacher
    // (This helps maintain data integrity)
    const { TeacherAssignment } = await import("@/models/TeacherAssignment");
    await TeacherAssignment.updateMany(
      { teacherId: teacherObjId, status: "active" },
      { $set: { status: "inactive" } }
    );

    // Remove from homeroom if assigned
    if (teacher.homeroomClassGroupId) {
      await ClassGroup.findByIdAndUpdate(teacher.homeroomClassGroupId, {
        $unset: { homeroomTeacherId: 1 },
      });
      // Clear from teacher record
      await Teacher.findByIdAndUpdate(teacherObjId, {
        $unset: { homeroomClassGroupId: 1 },
      });
    }

    // Log activity
    await logTeacherActivity({
      teacherId: String(teacher._id),
      schoolId: schoolIdObj,
        type: "teacher.status_changed",
      title: "Teacher terminated",
      description: `${teacherName} was terminated. Status changed from "${previousStatus}" to "terminated".`,
      metadata: {
        previousStatus,
        newStatus: "terminated",
        terminatedBy: adminUserId,
        assignmentsDeactivated: true,
        homeroomCleared: !!teacher.homeroomClassGroupId,
      },
      createdBy: adminUserId,
    });

    return Response.json({
      success: true,
      message: "Teacher terminated successfully",
      data: { id: String(teacher._id), status: "terminated" },
    });
  } catch (e) {
    console.error("Teacher delete error:", e);
    return Response.json(
      { error: "Failed to terminate teacher" },
      { status: 500 }
    );
  }
}
