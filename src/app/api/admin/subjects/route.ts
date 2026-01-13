// src/app/api/admin/subjects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Subject } from "@/models/Subject";
import { ClassGroup } from "@/models/ClassGroup";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import mongoose from "mongoose";

/**
 * GET /api/admin/subjects
 * Get all subjects with metadata
 */
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
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
    const message = e instanceof Error ? e.message : "Failed to fetch subjects";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
