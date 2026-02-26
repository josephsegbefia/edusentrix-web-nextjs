// src/app/api/admin/classes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import { Student } from "@/models/Student";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import mongoose from "mongoose";
import { z } from "zod";

const CreateClassSchema = z.object({
  gradeId: z.string().min(1, "Grade is required"),
  name: z.string().min(1, "Class name is required").max(50),
  subjectIds: z.array(z.string()).optional().default([]),
  capacity: z.number().int().positive().optional().nullable(),
});

/**
 * POST /api/admin/classes
 * Create a new class under a grade
 */
export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    const body = await req.json().catch(() => ({}));
    const parsed = CreateClassSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { gradeId, name, subjectIds, capacity } = parsed.data;

    const gradeIdObj = new mongoose.Types.ObjectId(gradeId);

    // Verify grade exists and belongs to school
    const { Grade } = await import("@/models/Grade");
    const gradeDoc = await Grade.findOne({
      _id: gradeIdObj,
      schoolId: schoolIdObj,
    }).lean();
    if (!gradeDoc) {
      return NextResponse.json(
        { success: false, error: "Grade not found" },
        { status: 404 }
      );
    }

    // Check for duplicate class name in same grade
    const existing = await ClassGroup.findOne({
      schoolId: schoolIdObj,
      gradeId: gradeIdObj,
      name: name.trim(),
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Class "${name}" already exists in this grade` },
        { status: 409 }
      );
    }

    const subjectIdsObj = (subjectIds || [])
      .filter(Boolean)
      .map((id) => new mongoose.Types.ObjectId(id));

    const newClass = await ClassGroup.create({
      schoolId: schoolIdObj,
      gradeId: gradeIdObj,
      name: name.trim(),
      subjectIds: subjectIdsObj,
      capacity: capacity ?? null,
      isActive: true,
    });

    const populated = await ClassGroup.findById(newClass._id)
      .populate("gradeId", "name code stage order")
      .populate("subjectIds", "name code")
      .lean();

    const gradePop = populated?.gradeId as { _id: string; name: string; code?: string; stage?: string; order?: number } | null;
    const subjectPop = (populated?.subjectIds || []) as Array<{ _id: string; name: string; code?: string }>;
    return NextResponse.json({
      success: true,
      data: {
        id: String(newClass._id),
        name: newClass.name,
        fullLabel: gradePop ? `${gradePop.name} ${newClass.name}` : newClass.name,
        grade: gradePop
          ? {
              id: String(gradePop._id),
              name: gradePop.name,
              code: gradePop.code || null,
              stage: gradePop.stage || null,
              order: gradePop.order || 0,
            }
          : null,
        homeroomTeacher: null,
        subjects: subjectPop.map((s) => ({
          id: String(s._id),
          name: s.name,
          code: s.code || null,
        })),
        studentCount: 0,
        teacherCount: 0,
        subjectCount: subjectIdsObj.length,
        capacity: newClass.capacity,
        isActive: newClass.isActive,
      },
    });
  } catch (e: unknown) {
    console.error("Error creating class:", e);
    const message = e instanceof Error ? e.message : "Failed to create class";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * GET /api/admin/classes
 * Get all classes with metadata, filters, and sorting
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
    const teacherId = searchParams.get("teacherId");
    const isActive = searchParams.get("isActive");
    const sortBy = searchParams.get("sortBy") || "name";
    const sortOrder = searchParams.get("sortOrder") || "asc";

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

    // If filtering by teacher, we need to find classes where the teacher teaches
    let classIdsWithTeacher: mongoose.Types.ObjectId[] | null = null;
    if (teacherId) {
      const teacherIdObj = new mongoose.Types.ObjectId(teacherId);

      // Find classes where this teacher is homeroom OR teaches a subject
      const [homeroomClasses, assignmentClasses] = await Promise.all([
        ClassGroup.find({
          schoolId: schoolIdObj,
          homeroomTeacherId: teacherIdObj,
        })
          .select("_id")
          .lean(),
        TeacherAssignment.find({
          schoolId: schoolIdObj,
          teacherId: teacherIdObj,
          status: "active",
        })
          .select("classGroupId")
          .lean(),
      ]);

      const classIdSet = new Set<string>();
      homeroomClasses.forEach((c) => classIdSet.add(String(c._id)));
      assignmentClasses.forEach((a: any) =>
        classIdSet.add(String(a.classGroupId))
      );

      classIdsWithTeacher = Array.from(classIdSet).map(
        (id) => new mongoose.Types.ObjectId(id)
      );

      if (classIdsWithTeacher.length === 0) {
        // No classes for this teacher
        return NextResponse.json({
          success: true,
          data: [],
          total: 0,
        });
      }

      query._id = { $in: classIdsWithTeacher };
    }

    // Fetch classes with basic population first
    const classes = await ClassGroup.find(query)
      .populate("gradeId", "name code stage order")
      .populate("subjectIds", "name code")
      .lean();

    // Get homeroom teacher IDs that exist
    const homeroomTeacherIds = classes
      .map((c: any) => c.homeroomTeacherId)
      .filter((id: any) => id !== null && id !== undefined);

    // Populate homeroom teachers separately if any exist
    const homeroomTeachersMap = new Map();
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

    // Get current academic period
    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: schoolIdObj,
      isCurrent: true,
    })
      .select("_id")
      .lean() as { _id: any } | null;

    // Get teacher counts (subject teachers) for each class
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

    let data = classes.map((cls: any) => {
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

    // Apply sorting
    const sortMultiplier = sortOrder === "desc" ? -1 : 1;
    data.sort((a, b) => {
      switch (sortBy) {
        case "grade":
          // Sort by grade order, then by name
          const gradeOrderDiff = (a.grade.order - b.grade.order) * sortMultiplier;
          if (gradeOrderDiff !== 0) return gradeOrderDiff;
          return a.name.localeCompare(b.name) * sortMultiplier;
        case "students":
          return (a.studentCount - b.studentCount) * sortMultiplier;
        case "subjects":
          return (a.subjectCount - b.subjectCount) * sortMultiplier;
        case "teachers":
          return (a.teacherCount - b.teacherCount) * sortMultiplier;
        case "createdAt":
          return (
            (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) *
            sortMultiplier
          );
        case "name":
        default:
          // Sort by grade order first, then by class name
          const orderDiff = a.grade.order - b.grade.order;
          if (orderDiff !== 0) return orderDiff * sortMultiplier;
          return a.name.localeCompare(b.name) * sortMultiplier;
      }
    });

    return NextResponse.json({
      success: true,
      data,
      total: data.length,
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
