// src/app/api/admin/classes/[id]/subject-teachers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireClassTimetableEditor } from "@/lib/auth/requireClassTimetableEditor";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { SubjectOffering } from "@/models/SubjectOffering";
import { ClassGroup } from "@/models/ClassGroup";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { isPreschoolLearningAreaGrade } from "@/constants/curriculum-subject-templates";
import mongoose from "mongoose";

/**
 * GET /api/admin/classes/[id]/subject-teachers
 * Get all subject-teacher assignments for a class
 */
function toObjectIdOrNull(id: string | null): mongoose.Types.ObjectId | null {
  if (!id) return null;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: classId } = await params;

    let classIdObj: mongoose.Types.ObjectId;
    try {
      classIdObj = new mongoose.Types.ObjectId(classId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid class ID" },
        { status: 400 }
      );
    }

    const editor = await requireClassTimetableEditor(classId);
    await connectToDatabase();

    const schoolIdObj =
      editor.schoolId instanceof mongoose.Types.ObjectId
        ? editor.schoolId
        : new mongoose.Types.ObjectId(String(editor.schoolId));

    // Verify class belongs to school
    const classGroup = await ClassGroup.findOne({
      _id: classIdObj,
      schoolId: schoolIdObj,
    })
      .populate("gradeId", "name code")
      .select("_id gradeId subjectOfferingIds")
      .lean();

    if (!classGroup) {
      return NextResponse.json(
        { success: false, error: "Class not found" },
        { status: 404 }
      );
    }

    if (isPreschoolLearningAreaGrade((classGroup as any).gradeId ?? {})) {
      return NextResponse.json({ success: true, data: [] });
    }

    const academicPeriodIdParam = req.nextUrl.searchParams.get("academicPeriodId");
    let activePeriod: { _id: mongoose.Types.ObjectId } | null = null;
    const requestedAp = toObjectIdOrNull(academicPeriodIdParam);
    if (requestedAp) {
      const found = await AcademicPeriod.findOne({
        _id: requestedAp,
        schoolId: schoolIdObj,
      })
        .select("_id")
        .lean();
      if (found) activePeriod = found as { _id: mongoose.Types.ObjectId };
    }
    if (!activePeriod) {
      const currentPeriod = await AcademicPeriod.findOne({
        schoolId: schoolIdObj,
        isCurrent: true,
      })
        .select("_id")
        .lean();
      if (currentPeriod) activePeriod = currentPeriod as { _id: mongoose.Types.ObjectId };
    }

    const subjectOfferingIds = (classGroup as { subjectOfferingIds?: mongoose.Types.ObjectId[] }).subjectOfferingIds || [];
    const allOfferings = await SubjectOffering.find({
      _id: { $in: subjectOfferingIds },
      schoolId: schoolIdObj,
      isActive: true,
    })
      .select("_id subjectId displayName shortName code")
      .lean();
    const offeringBySubjectId = new Map<string, (typeof allOfferings)[number]>();
    for (const offering of allOfferings) {
      offeringBySubjectId.set(String(offering.subjectId), offering);
    }

    if (!activePeriod) {
      const data = allOfferings.map((offering) => ({
        subjectOfferingId: String(offering._id),
        subjectId: String(offering.subjectId),
        subjectName: offering.displayName || offering.shortName,
        subjectCode: offering.code || null,
        teachers: [],
      }));

      return NextResponse.json({ success: true, data });
    }

    // Get all active assignments for this class and period
    const assignments = await TeacherAssignment.find({
      schoolId: schoolIdObj,
      classGroupId: classIdObj,
      academicPeriodId: activePeriod._id,
      status: "active",
    })
      .populate({
        path: "teacherId",
        select: "userId",
        populate: {
          path: "userId",
          select: "firstName lastName email avatarUrl",
        },
      })
      .populate("subjectOfferingId", "displayName shortName code subjectId")
      .populate("subjectId", "name code")
      .lean();

    // Group assignments by subject
    const subjectTeachersMap = new Map<
      string,
      {
        subjectId: string;
        subjectOfferingId: string | null;
        subjectName: string;
        subjectCode: string | null;
        teachers: Array<{
          id: string;
          assignmentId: string;
          contactHoursPerWeek: number | null;
          firstName: string;
          lastName: string;
          fullName: string;
          email: string | null;
          photoUrl: string | null;
        }>;
      }
    >();

    for (const assignment of assignments) {
      const assignmentOffering = (assignment as any).subjectOfferingId;
      const legacySubject = (assignment as any).subjectId;
      const fallbackOffering = legacySubject?._id
        ? offeringBySubjectId.get(String(legacySubject._id))
        : null;
      const offering = assignmentOffering || fallbackOffering;
      const subject = offering || legacySubject;
      const teacher = (assignment as any).teacherId;
      const user = teacher?.userId;

      if (!subject) continue;

      const subjectIdStr = String(offering?.subjectId || legacySubject?._id || subject._id);
      const offeringIdStr = offering?._id ? String(offering._id) : null;
      const mapKey = offeringIdStr || subjectIdStr;

      if (!subjectTeachersMap.has(mapKey)) {
        subjectTeachersMap.set(mapKey, {
          subjectOfferingId: offeringIdStr,
          subjectId: subjectIdStr,
          subjectName: offering?.displayName || offering?.shortName || legacySubject?.name || subject.name,
          subjectCode: offering?.code || legacySubject?.code || subject.code || null,
          teachers: [],
        });
      }

      if (teacher && user) {
        subjectTeachersMap.get(mapKey)!.teachers.push({
          id: String(teacher._id),
          assignmentId: String(assignment._id),
          contactHoursPerWeek:
            typeof (assignment as { contactHoursPerWeek?: unknown }).contactHoursPerWeek === "number"
              ? ((assignment as { contactHoursPerWeek: number }).contactHoursPerWeek)
              : null,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          email: user.email || null,
          photoUrl: user.avatarUrl || null,
        });
      }
    }

    // Also include offerings assigned to the class but without a teacher yet.
    for (const offering of allOfferings) {
      const offeringIdStr = String(offering._id);
      if (!subjectTeachersMap.has(offeringIdStr)) {
        subjectTeachersMap.set(offeringIdStr, {
          subjectOfferingId: offeringIdStr,
          subjectId: String(offering.subjectId),
          subjectName: offering.displayName || offering.shortName,
          subjectCode: offering.code || null,
          teachers: [],
        });
      }
    }

    const data = Array.from(subjectTeachersMap.values()).sort((a, b) =>
      a.subjectName.localeCompare(b.subjectName)
    );

    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Error fetching subject-teachers:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch subject teachers";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
