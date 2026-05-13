import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";

function objectId(value: string | undefined): mongoose.Types.ObjectId | null {
  return value && mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedModuleView("subjects");
    await connectToDatabase();
    const { id } = await ctx.params;
    const offeringId = objectId(id);
    if (!offeringId) return NextResponse.json({ success: false, error: "Invalid offering id" }, { status: 400 });

    const body = await req.json();
    const teacherId = objectId(String(body.teacherId || ""));
    const classGroupId = objectId(String(body.classGroupId || ""));
    if (!teacherId || !classGroupId) {
      return NextResponse.json({ success: false, error: "teacherId and classGroupId are required" }, { status: 400 });
    }

    const [offering, teacher, classGroup, currentPeriod] = await Promise.all([
      SubjectOffering.findOne({ _id: offeringId, schoolId, isActive: { $ne: false } }).lean(),
      Teacher.findOne({ _id: teacherId, schoolId }).select("_id").lean(),
      ClassGroup.findOne({ _id: classGroupId, schoolId }).select("_id gradeId").lean(),
      AcademicPeriod.findOne({ schoolId, isCurrent: true }).select("_id").lean(),
    ]);
    if (!offering) return NextResponse.json({ success: false, error: "Active subject offering not found" }, { status: 404 });
    if (!teacher) return NextResponse.json({ success: false, error: "Teacher not found" }, { status: 404 });
    if (!classGroup) return NextResponse.json({ success: false, error: "Class group not found" }, { status: 404 });
    if (!currentPeriod?._id) return NextResponse.json({ success: false, error: "No current academic period found" }, { status: 400 });

    const compatibleGradeIds = new Set((offering.gradeIds || []).map(String));
    if (!compatibleGradeIds.has(String(classGroup.gradeId)) && body.allowIncompatible !== true) {
      return NextResponse.json({ success: false, error: "This offering does not cover the class group's grade" }, { status: 400 });
    }

    await ClassGroup.updateOne(
      { _id: classGroupId, schoolId },
      { $addToSet: { subjectOfferingIds: offeringId, subjectIds: offering.subjectId } }
    );
    await Teacher.updateOne(
      { _id: teacherId, schoolId },
      { $addToSet: { subjectIds: offering.subjectId } }
    );

    const assignment = await TeacherAssignment.findOneAndUpdate(
      {
        schoolId,
        teacherId,
        classGroupId,
        academicPeriodId: currentPeriod._id,
        subjectOfferingId: offeringId,
        status: "active",
      },
      {
        $setOnInsert: {
          subjectId: offering.subjectId,
          assignedBy: userId && mongoose.Types.ObjectId.isValid(String(userId)) ? new mongoose.Types.ObjectId(String(userId)) : null,
          assignedAt: new Date(),
        },
        $set: {
          workloadHours: typeof body.workloadHours === "number" ? body.workloadHours : undefined,
          notes: typeof body.notes === "string" ? body.notes : undefined,
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      data: {
        id: String(assignment._id),
        teacherId: String(teacherId),
        classGroupId: String(classGroupId),
        subjectId: String(offering.subjectId),
        subjectOfferingId: String(offeringId),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to assign teacher";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
