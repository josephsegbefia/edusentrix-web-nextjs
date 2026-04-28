/* eslint-disable @typescript-eslint/no-explicit-any */
// GET /api/admin/grades/[gradeId]/overview
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { Student } from "@/models/Student";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Invoice } from "@/models/Invoice";
import mongoose from "mongoose";

const ACTIVE_INVOICE_STATUSES = ["issued", "partially_paid", "overdue"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gradeId: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("grades");
    await connectToDatabase();

    const { gradeId } = await params;
    let gradeIdObj: mongoose.Types.ObjectId;
    try {
      gradeIdObj = new mongoose.Types.ObjectId(gradeId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid grade ID" },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    // Fetch grade
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

    const grade = {
      id: String(gradeDoc._id),
      name: gradeDoc.name,
      code: gradeDoc.code ?? null,
      stage: gradeDoc.stage ?? "Basic",
      order: gradeDoc.order ?? 0,
    };

    // Fetch classes in this grade
    const classes = await ClassGroup.find({
      schoolId: schoolIdObj,
      gradeId: gradeIdObj,
      isActive: true,
    })
      .populate("subjectIds", "name code")
      .lean();

    const classIds = classes.map((c: any) => c._id);

    // Current academic period
    const currentPeriodDoc = await AcademicPeriod.findOne({
      schoolId: schoolIdObj,
      isCurrent: true,
    })
      .select("_id yearLabel term")
      .lean();

    const currentPeriod = currentPeriodDoc
      ? {
          yearLabel: currentPeriodDoc.yearLabel ?? "",
          term: currentPeriodDoc.term ?? "",
        }
      : null;

    // Stats: totalStudents, totalClasses, totalCapacity, avgClassSize, classesWithoutHomeroom
    const totalStudents = await Student.countDocuments({
      schoolId: schoolIdObj,
      gradeId: gradeIdObj,
      status: { $in: ["active", "enrolled"] },
    });

    const totalClasses = classes.length;

    let totalCapacity = 0;
    let classesWithoutHomeroom = 0;
    for (const cls of classes) {
      const c = cls as any;
      if (c.capacity != null) totalCapacity += c.capacity;
      if (!c.homeroomTeacherId) classesWithoutHomeroom++;
    }

    const avgClassSize =
      totalClasses > 0 ? Math.round(totalStudents / totalClasses) : 0;

    // Subjects: union of all subjectIds from classes, with classesWithSubject / classesWithoutSubject
    const allSubjectIds = new Set<string>();
    for (const cls of classes) {
      const subjectIds = (cls as any).subjectIds ?? [];
      for (const s of subjectIds) {
        if (s?._id) allSubjectIds.add(String(s._id));
      }
    }

    const subjects: Array<{
      id: string;
      name: string;
      classesWithSubject: number;
      classesWithoutSubject: number;
    }> = [];

    for (const subId of allSubjectIds) {
      let classesWithSubject = 0;
      let subName = "Unknown";
      for (const cls of classes) {
        const subjectIds = (cls as any).subjectIds ?? [];
        const found = subjectIds.find(
          (s: any) => s?._id && String(s._id) === subId
        );
        if (found) {
          classesWithSubject++;
          if (found.name) subName = found.name;
        }
      }
      subjects.push({
        id: subId,
        name: subName,
        classesWithSubject,
        classesWithoutSubject: totalClasses - classesWithSubject,
      });
    }

    // subjectsWithoutTeacher: subjects assigned to classes but no TeacherAssignment for current period
    let subjectsWithoutTeacher = 0;
    if (currentPeriodDoc) {
      const assignments = await TeacherAssignment.find({
        schoolId: schoolIdObj,
        classGroupId: { $in: classIds },
        academicPeriodId: currentPeriodDoc._id,
        status: "active",
      })
        .select("subjectId classGroupId")
        .lean();

      const subjectClassPairs = new Set<string>();
      for (const a of assignments) {
        subjectClassPairs.add(
          `${(a as any).subjectId}-${(a as any).classGroupId}`
        );
      }

      for (const cls of classes) {
        const subjectIds = (cls as any).subjectIds ?? [];
        for (const s of subjectIds) {
          if (!s?._id) continue;
          const key = `${s._id}-${(cls as any)._id}`;
          if (!subjectClassPairs.has(key)) {
            subjectsWithoutTeacher++;
          }
        }
      }
    }

    const stats = {
      totalStudents,
      totalClasses,
      totalCapacity: totalCapacity || null,
      avgClassSize,
      classesWithoutHomeroom,
      subjectsWithoutTeacher,
    };

    // Class distribution for this grade
    const studentCounts = await Student.aggregate([
      {
        $match: {
          schoolId: schoolIdObj,
          classGroupId: { $in: classIds },
          status: { $in: ["active", "enrolled"] },
        },
      },
      { $group: { _id: "$classGroupId", count: { $sum: 1 } } },
    ]);

    const countMap = new Map(
      studentCounts.map((d: any) => [String(d._id), d.count])
    );

    const gradeName = gradeDoc.name;
    const classDistribution = classes.map((cls: any) => ({
      classGroupId: String(cls._id),
      classGroupName: cls.name,
      gradeName,
      count: countMap.get(String(cls._id)) ?? 0,
    }));

    // Fee defaulters: students in this grade with outstanding invoices
    let feeDefaultersCount = 0;
    try {
      const studentsWithOwing = await Invoice.aggregate([
        {
          $match: {
            schoolId: schoolIdObj,
            status: { $in: ACTIVE_INVOICE_STATUSES },
            totalOutstandingMinor: { $gt: 0 },
          },
        },
        { $group: { _id: "$studentId" } },
        {
          $lookup: {
            from: "students",
            localField: "_id",
            foreignField: "_id",
            as: "student",
          },
        },
        { $unwind: "$student" },
        {
          $match: {
            "student.gradeId": gradeIdObj,
            "student.status": { $in: ["active", "enrolled"] },
          },
        },
        { $count: "count" },
      ]);
      feeDefaultersCount = studentsWithOwing[0]?.count ?? 0;
    } catch {
      // Fee system may not be fully wired; return 0
    }

    return NextResponse.json({
      success: true,
      data: {
        grade,
        stats,
        subjects,
        classDistribution,
        currentPeriod,
        feeDefaultersCount,
      },
    });
  } catch (e: unknown) {
    console.error("Error fetching grade overview:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch grade overview";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
