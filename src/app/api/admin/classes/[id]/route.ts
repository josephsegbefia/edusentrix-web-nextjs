// src/app/api/admin/classes/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import { Student } from "@/models/Student";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { SubjectOffering } from "@/models/SubjectOffering";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Teacher } from "@/models/Teacher";
import mongoose from "mongoose";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * GET /api/admin/classes/[id]
 * Get a single class with full details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    // Ensure models used by populate are registered
    void Grade;
    void Subject;
    void SubjectOffering;

    const { id } = await params;
    const classId = toObjectIdOrNull(id);
    if (!classId) {
      return NextResponse.json(
        { success: false, error: "Invalid class ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    // Fetch the class with populated fields
    const cls = await ClassGroup.findOne({
      _id: classId,
      schoolId: schoolIdObj,
    })
      .populate("gradeId", "name code stage order")
      .populate("subjectOfferingIds", "displayName shortName code subjectId")
      .populate("subjectIds", "name code")
      .lean();

    if (!cls) {
      return NextResponse.json(
        { success: false, error: "Class not found" },
        { status: 404 }
      );
    }

    // Get homeroom teacher details if assigned
    let homeroomTeacher = null;
    if ((cls as any).homeroomTeacherId) {
      const { Teacher } = await import("@/models/Teacher");
      const teacher = await Teacher.findById((cls as any).homeroomTeacherId)
        .populate("userId", "firstName lastName email avatarUrl")
        .lean() as { _id: any; userId: any } | null;

      if (teacher) {
        const user = teacher.userId;
        homeroomTeacher = {
          id: String(teacher._id),
          firstName: user?.firstName || "",
          lastName: user?.lastName || "",
          fullName: user
            ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
            : "",
          email: user?.email || null,
          photoUrl: user?.avatarUrl || null,
        };
      }
    }

    // Get student count
    const studentCount = await Student.countDocuments({
      schoolId: schoolIdObj,
      classGroupId: classId,
      status: { $in: ["active", "enrolled"] },
    });

    // Get current academic period
    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: schoolIdObj,
      isCurrent: true,
    })
      .select("_id")
      .lean() as { _id: any } | null;

    // Get teacher count (subject teachers)
    let teacherCount = 0;
    if (currentPeriod) {
      const result = await TeacherAssignment.aggregate([
        {
          $match: {
            schoolId: schoolIdObj,
            classGroupId: classId,
            academicPeriodId: currentPeriod._id,
            status: "active",
          },
        },
        {
          $group: {
            _id: null,
            uniqueTeachers: { $addToSet: "$teacherId" },
          },
        },
        {
          $project: {
            count: { $size: "$uniqueTeachers" },
          },
        },
      ]);
      teacherCount = result[0]?.count || 0;
    }

    const grade = (cls as any).gradeId;

    const data = {
      id: String((cls as any)._id),
      name: (cls as any).name,
      fullLabel: grade ? `${grade.name} ${(cls as any).name}` : (cls as any).name,
      grade: grade
        ? {
            id: String(grade._id),
            name: grade.name,
            code: grade.code || null,
            stage: grade.stage || null,
            order: grade.order || 0,
          }
        : {
            id: "",
            name: "Unknown",
            code: null,
            stage: null,
            order: 0,
          },
      homeroomTeacher,
      subjects:
        ((cls as any).subjectOfferingIds || []).length > 0
          ? ((cls as any).subjectOfferingIds || []).map((offering: any) => ({
              id: String(offering.subjectId || offering._id),
              subjectOfferingId: String(offering._id),
              name: offering.displayName || offering.shortName,
              code: offering.code || null,
            }))
          : ((cls as any).subjectIds || []).map((s: any) => ({
              id: String(s._id),
              subjectOfferingId: null,
              name: s.name,
              code: s.code || null,
            })),
      studentCount,
      teacherCount,
      subjectCount:
        (cls as any).subjectOfferingIds?.length || (cls as any).subjectIds?.length || 0,
      capacity: (cls as any).capacity || null,
      defaultRoomName: (cls as any).defaultRoomName || null,
      isActive: (cls as any).isActive,
      createdAt: new Date((cls as any).createdAt).toISOString(),
      updatedAt: new Date((cls as any).updatedAt).toISOString(),
    };

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (e: unknown) {
    console.error("Error fetching class:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch class";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/classes/[id]
 * Update a class (e.g., assign homeroom teacher)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await params;
    const classId = toObjectIdOrNull(id);
    if (!classId) {
      return NextResponse.json(
        { success: false, error: "Invalid class ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const body = await req.json();

    const updateData: Record<string, unknown> = {};
    let nextHomeroomTeacherId: mongoose.Types.ObjectId | null | undefined;

    if (body.homeroomTeacherId !== undefined) {
      if (body.homeroomTeacherId === null || body.homeroomTeacherId === "") {
        updateData.homeroomTeacherId = null;
        nextHomeroomTeacherId = null;
      } else {
        const teacherId = toObjectIdOrNull(body.homeroomTeacherId);
        if (!teacherId) {
          return NextResponse.json(
            { success: false, error: "Invalid teacher ID" },
            { status: 400 }
          );
        }
        updateData.homeroomTeacherId = teacherId;
        nextHomeroomTeacherId = teacherId;
      }
    }

    if (body.name !== undefined) {
      const nextName = String(body.name).trim();
      if (!nextName) {
        return NextResponse.json(
          { success: false, error: "Class name is required" },
          { status: 400 }
        );
      }
      updateData.name = nextName;
    }

    if (body.capacity !== undefined) {
      if (body.capacity === null || body.capacity === "") {
        updateData.capacity = null;
      } else {
        const parsedCapacity = parseInt(String(body.capacity), 10);
        if (!Number.isFinite(parsedCapacity) || parsedCapacity < 0) {
          return NextResponse.json(
            { success: false, error: "Capacity must be a valid positive number" },
            { status: 400 }
          );
        }
        updateData.capacity = parsedCapacity;
      }
    }

    if (body.defaultRoomName !== undefined) {
      const nextRoomName = String(body.defaultRoomName || "").trim();
      updateData.defaultRoomName = nextRoomName || null;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive === true;
    }

    const existingClassGroup =
      nextHomeroomTeacherId !== undefined
        ? await ClassGroup.findOne({ _id: classId, schoolId: schoolIdObj })
            .select("homeroomTeacherId")
            .lean()
        : null;

    if (nextHomeroomTeacherId) {
      const teacher = await Teacher.findOne({
        _id: nextHomeroomTeacherId,
        schoolId: schoolIdObj,
      })
        .select("_id homeroomClassGroupId")
        .lean();

      if (!teacher) {
        return NextResponse.json(
          { success: false, error: "Teacher not found" },
          { status: 404 }
        );
      }

      if (
        teacher.homeroomClassGroupId &&
        String(teacher.homeroomClassGroupId) !== String(classId)
      ) {
        await ClassGroup.updateOne(
          { _id: teacher.homeroomClassGroupId, schoolId: schoolIdObj },
          { $unset: { homeroomTeacherId: 1 } }
        );
      }
    }

    if (
      existingClassGroup?.homeroomTeacherId &&
      (!nextHomeroomTeacherId ||
        String(existingClassGroup.homeroomTeacherId) !== String(nextHomeroomTeacherId))
    ) {
      await Teacher.updateOne(
        { _id: existingClassGroup.homeroomTeacherId, schoolId: schoolIdObj },
        { $unset: { homeroomClassGroupId: 1 } }
      );
    }

    const updated = await ClassGroup.findOneAndUpdate(
      { _id: classId, schoolId: schoolIdObj },
      { $set: updateData },
      { new: true }
    )
      .populate("gradeId", "name code")
      .populate("homeroomTeacherId", "userId")
      .populate("homeroomTeacherId.userId", "firstName lastName email avatarUrl")
      .lean() as { _id: any; name: string; homeroomTeacherId?: { _id: any } } | null;

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Class not found" },
        { status: 404 }
      );
    }

    if (nextHomeroomTeacherId) {
      await Teacher.updateOne(
        { _id: nextHomeroomTeacherId, schoolId: schoolIdObj },
        { $set: { homeroomClassGroupId: classId } }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(updated._id),
        name: updated.name,
        capacity: (updated as any).capacity ?? null,
        defaultRoomName: (updated as any).defaultRoomName ?? null,
        isActive: (updated as any).isActive === true,
        homeroomTeacherId: updated.homeroomTeacherId
          ? String(updated.homeroomTeacherId._id)
          : null,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to update class";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
