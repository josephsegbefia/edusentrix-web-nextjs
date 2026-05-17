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
import { SubjectOffering } from "@/models/SubjectOffering";
import {
  getPreschoolLearningAreaNames,
  isPreschoolLearningAreaGrade,
} from "@/constants/curriculum-subject-templates";
import mongoose from "mongoose";

const ACTIVE_INVOICE_STATUSES = ["issued", "partially_paid", "overdue"];

function isLearningAreaSubject(
  subject: any,
  recommendedLearningAreas: Set<string>
): boolean {
  const name = typeof subject?.name === "string" ? subject.name.trim() : "";
  return (
    subject?.category === "learning_area" ||
    (name.length > 0 && recommendedLearningAreas.has(name.toLowerCase()))
  );
}

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
    const isPreschoolGrade = isPreschoolLearningAreaGrade(grade);
    const recommendedLearningAreas = new Set(
      getPreschoolLearningAreaNames(grade).map((name) => name.toLowerCase())
    );

    // Fetch classes in this grade
    const classes = await ClassGroup.find({
      schoolId: schoolIdObj,
      gradeId: gradeIdObj,
      isActive: true,
    })
      .populate({
        path: "subjectOfferingIds",
        select: "displayName shortName code gradeBand",
        model: SubjectOffering,
      })
      .populate("subjectIds", "name code category")
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

    // Academic units: preschool grades use learning areas only; other grades use subject offerings.
    const allSubjectOfferingIds = new Set<string>();
    const allLearningAreaIds = new Set<string>();
    for (const cls of classes) {
      if (isPreschoolGrade) {
        const subjectIds = (cls as any).subjectIds ?? [];
        for (const subject of subjectIds) {
          if (subject?._id && isLearningAreaSubject(subject, recommendedLearningAreas)) {
            allLearningAreaIds.add(String(subject._id));
          }
        }
      } else {
        const subjectOfferingIds = (cls as any).subjectOfferingIds ?? [];
        for (const offering of subjectOfferingIds) {
          if (offering?._id) allSubjectOfferingIds.add(String(offering._id));
        }
      }
    }

    const subjects: Array<{
      id: string;
      name: string;
      code?: string | null;
      classesWithSubject: number;
      classesWithoutSubject: number;
    }> = [];

    if (isPreschoolGrade) {
      for (const subjectId of allLearningAreaIds) {
        let classesWithSubject = 0;
        let subjectName = "Unknown learning area";
        let subjectCode: string | null = null;
        for (const cls of classes) {
          const subjectIds = (cls as any).subjectIds ?? [];
          const found = subjectIds.find(
            (subject: any) => subject?._id && String(subject._id) === subjectId
          );
          if (found && isLearningAreaSubject(found, recommendedLearningAreas)) {
            classesWithSubject++;
            subjectName = found.name || subjectName;
            subjectCode = found.code ?? subjectCode;
          }
        }
        subjects.push({
          id: subjectId,
          name: subjectName,
          code: subjectCode,
          classesWithSubject,
          classesWithoutSubject: totalClasses - classesWithSubject,
        });
      }
    }

    for (const offeringId of isPreschoolGrade ? [] : allSubjectOfferingIds) {
      let classesWithSubject = 0;
      let offeringName = "Unknown offering";
      let offeringCode: string | null = null;
      for (const cls of classes) {
        const subjectOfferingIds = (cls as any).subjectOfferingIds ?? [];
        const found = subjectOfferingIds.find(
          (offering: any) => offering?._id && String(offering._id) === offeringId
        );
        if (found) {
          classesWithSubject++;
          if (found.displayName || found.shortName) {
            offeringName = found.displayName || found.shortName;
          }
          offeringCode = found.code ?? offeringCode;
        }
      }
      subjects.push({
        id: offeringId,
        name: offeringName,
        code: offeringCode,
        classesWithSubject,
        classesWithoutSubject: totalClasses - classesWithSubject,
      });
    }

    // subjectsWithoutTeacher: subject offerings assigned to classes but no TeacherAssignment for current period.
    // Preschool learning areas are managed separately and do not require subject-teacher coverage checks.
    let subjectsWithoutTeacher = 0;
    if (!isPreschoolGrade && currentPeriodDoc) {
      const assignments = await TeacherAssignment.find({
        schoolId: schoolIdObj,
        classGroupId: { $in: classIds },
        academicPeriodId: currentPeriodDoc._id,
        status: "active",
      })
        .select("subjectOfferingId classGroupId")
        .lean();

      const subjectClassPairs = new Set<string>();
      for (const a of assignments) {
        if (!(a as any).subjectOfferingId) continue;
        subjectClassPairs.add(
          `${(a as any).subjectOfferingId}-${(a as any).classGroupId}`
        );
      }

      for (const cls of classes) {
        const subjectOfferingIds = (cls as any).subjectOfferingIds ?? [];
        for (const offering of subjectOfferingIds) {
          if (!offering?._id) continue;
          const key = `${offering._id}-${(cls as any)._id}`;
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
