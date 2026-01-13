// src/app/api/admin/classes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import { Student } from "@/models/Student";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import mongoose from "mongoose";

/**
 * GET /api/admin/classes
 * Get all classes with metadata
 */
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();
    // Ensure models used by populate are registered before querying.
    void Grade;
    void Subject;

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search") || "";
    const gradeId = searchParams.get("gradeId");
    const isActive = searchParams.get("isActive");

    const query: Record<string, unknown> = { schoolId: schoolIdObj };

    if (search) {
      query.name = new RegExp(search, "i");
    }

    if (gradeId) {
      query.gradeId = new mongoose.Types.ObjectId(gradeId);
    }

    if (isActive !== null && isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    // Fetch classes with basic population first
    const classes = await ClassGroup.find(query)
      .populate("gradeId", "name code stage order")
      .populate("subjectIds", "name code")
      .sort({ name: 1 })
      .lean();

    // Get homeroom teacher IDs that exist
    const homeroomTeacherIds = classes
      .map((c: any) => c.homeroomTeacherId)
      .filter((id: any) => id !== null && id !== undefined);

    // Populate homeroom teachers separately if any exist
    let homeroomTeachersMap = new Map();
    if (homeroomTeacherIds.length > 0) {
      const { Teacher } = await import("@/models/Teacher");
      const teachers = await Teacher.find({
        _id: { $in: homeroomTeacherIds },
      })
        .populate("userId", "firstName lastName email avatarUrl")
        .lean();

      for (const teacher of teachers) {
        const user = (teacher as any).userId;
        homeroomTeachersMap.set(String(teacher._id), {
          id: String(teacher._id),
          firstName: user?.firstName || "",
          lastName: user?.lastName || "",
          fullName: user
            ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
            : "",
          email: user?.email || null,
          photoUrl: user?.avatarUrl || null,
        });
      }
    }

    // Get student counts for each class
    const classIds = classes.map((c) => c._id);
    const studentCounts = await Student.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          classGroupId: { $in: classIds },
          status: { $in: ["active", "enrolled"] },
        },
      },
      {
        $group: {
          _id: "$classGroupId",
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map(
      studentCounts.map((s) => [String(s._id), s.count])
    );

    // Get teacher counts (subject teachers) for each class
    const currentPeriod = await mongoose
      .model("AcademicPeriod")
      .findOne({ schoolId: schoolIdObj, status: "active" })
      .select("_id")
      .lean();

    let teacherCountMap = new Map<string, number>();
    if (currentPeriod) {
      const teacherCounts = await TeacherAssignment.aggregate([
        {
          $match: {
            schoolId: schoolIdObj,
            classGroupId: { $in: classIds },
            academicPeriodId: currentPeriod._id,
            status: "active",
          },
        },
        {
          $group: {
            _id: "$classGroupId",
            uniqueTeachers: { $addToSet: "$teacherId" },
          },
        },
        {
          $project: {
            _id: 1,
            count: { $size: "$uniqueTeachers" },
          },
        },
      ]);

      teacherCountMap = new Map(
        teacherCounts.map((t) => [String(t._id), t.count])
      );
    }

    const data = classes.map((cls: any) => {
      const grade = cls.gradeId;
      const homeroomTeacherId = cls.homeroomTeacherId;
      const homeroomTeacher = homeroomTeacherId
        ? homeroomTeachersMap.get(String(homeroomTeacherId))
        : null;

      return {
        id: String(cls._id),
        name: cls.name,
        fullLabel: grade ? `${grade.name} ${cls.name}` : cls.name,
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
        subjects: (cls.subjectIds || []).map((s: any) => ({
          id: String(s._id),
          name: s.name,
          code: s.code || null,
        })),
        studentCount: countMap.get(String(cls._id)) || 0,
        teacherCount: teacherCountMap.get(String(cls._id)) || 0,
        subjectCount: cls.subjectIds?.length || 0,
        capacity: cls.capacity || null,
        isActive: cls.isActive,
        createdAt: new Date(cls.createdAt).toISOString(),
        updatedAt: new Date(cls.updatedAt).toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (e: unknown) {
    console.error("Error fetching classes:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch classes";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
