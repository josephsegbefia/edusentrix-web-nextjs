// src/app/api/admin/subjects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { requireSchoolAdminOrTeacherRead } from "@/lib/auth/requireSchoolAdminOrTeacherRead";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Subject } from "@/models/Subject";
import { ClassGroup } from "@/models/ClassGroup";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import mongoose from "mongoose";

/**
 * GET /api/admin/subjects
 * Get all subjects with metadata
 */
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrTeacherRead();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search") || "";
    const isActive = searchParams.get("isActive");

    const query: Record<string, unknown> = { schoolId: schoolIdObj };

    if (search) {
      query.name = new RegExp(search, "i");
    }

    if (isActive !== null && isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const subjects = await Subject.find(query)
      .sort({ name: 1 })
      .lean();

    // Get class counts and teacher counts for each subject
    const subjectIds = subjects.map((s) => s._id);

    // Count classes that have this subject assigned
    const classCounts = await ClassGroup.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          subjectIds: { $in: subjectIds },
        },
      },
      {
        $unwind: "$subjectIds",
      },
      {
        $match: {
          subjectIds: { $in: subjectIds },
        },
      },
      {
        $group: {
          _id: "$subjectIds",
          count: { $sum: 1 },
        },
      },
    ]);

    const classCountMap = new Map(
      classCounts.map((c) => [String(c._id), c.count])
    );

    // Count unique teachers teaching each subject
    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: schoolIdObj,
      isCurrent: true,
    })
      .select("_id")
      .lean() as { _id: any } | null;

    let teacherCountMap = new Map<string, number>();
    if (currentPeriod) {
      const teacherCounts = await TeacherAssignment.aggregate([
        {
          $match: {
            schoolId: schoolIdObj,
            subjectId: { $in: subjectIds },
            academicPeriodId: currentPeriod._id,
            status: "active",
          },
        },
        {
          $group: {
            _id: "$subjectId",
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

    const data = subjects.map((subj: any) => ({
      id: String(subj._id),
      name: subj.name,
      code: subj.code || null,
      classCount: classCountMap.get(String(subj._id)) || 0,
      teacherCount: teacherCountMap.get(String(subj._id)) || 0,
      isActive: subj.isActive,
      createdAt: new Date(subj.createdAt).toISOString(),
      updatedAt: new Date(subj.updatedAt).toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to fetch subjects";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/subjects
 * Create a single subject
 */
export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("subjects");
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const body = (await req.json()) as {
      name?: unknown;
      code?: unknown;
      category?: unknown;
      isActive?: unknown;
    };

    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    const code =
      typeof body.code === "string" && body.code.trim()
        ? body.code.trim().toUpperCase()
        : null;
    const category =
      typeof body.category === "string" && body.category.trim()
        ? body.category.trim()
        : null;
    const isActive = body.isActive !== false;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Subject name is required" },
        { status: 400 }
      );
    }

    const allowedCategories = new Set([
      "core",
      "elective",
      "foundation",
      "optional",
      "learning_area",
      "co_curricular",
      "custom",
      "transdisciplinary_theme",
      "subject_group",
    ]);

    if (category && !allowedCategories.has(category)) {
      return NextResponse.json(
        { success: false, error: "Invalid subject category" },
        { status: 400 }
      );
    }

    const normalizedKey = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    const existing = await Subject.findOne({
      schoolId: schoolIdObj,
      $or: [{ name }, { normalizedKey }],
    })
      .collation({ locale: "en", strength: 2 })
      .lean();

    if (existing) {
      return NextResponse.json(
        { success: false, error: "A subject with that name already exists" },
        { status: 409 }
      );
    }

    const created = await Subject.create({
      schoolId: schoolIdObj,
      name,
      normalizedKey,
      code,
      category,
      isActive,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: String(created._id),
          name: created.name,
          code: created.code || null,
          category: created.category || null,
          isActive: created.isActive,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Failed to create subject";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
