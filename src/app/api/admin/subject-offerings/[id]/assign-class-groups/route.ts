import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import { SubjectOffering } from "@/models/SubjectOffering";
import { isPreschoolLearningAreaGrade } from "@/constants/curriculum-subject-templates";

function objectId(value: string): mongoose.Types.ObjectId | null {
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("subjects");
    await connectToDatabase();
    const { id } = await ctx.params;
    const offeringId = objectId(id);
    if (!offeringId) return NextResponse.json({ success: false, error: "Invalid offering id" }, { status: 400 });

    const body = await req.json();
    const classGroupIds = Array.isArray(body.classGroupIds)
      ? body.classGroupIds.filter((value: unknown) => typeof value === "string" && mongoose.Types.ObjectId.isValid(value)).map((value: string) => new mongoose.Types.ObjectId(value))
      : [];

    const offering = await SubjectOffering.findOne({ _id: offeringId, schoolId, isActive: { $ne: false } }).lean();
    if (!offering) return NextResponse.json({ success: false, error: "Active subject offering not found" }, { status: 404 });
    const classes = await ClassGroup.find({ _id: { $in: classGroupIds }, schoolId })
      .populate("gradeId", "name code")
      .select("_id gradeId")
      .lean();
    const preschoolClasses = classes.filter((classGroup) =>
      isPreschoolLearningAreaGrade((classGroup as any).gradeId ?? {})
    );
    if (preschoolClasses.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Subject offerings are not assigned to Creche, Nursery, KG1, or KG2. Use Preschool Learning Areas on each grade page instead.",
          data: { preschoolClassGroupIds: preschoolClasses.map((item) => String(item._id)) },
        },
        { status: 400 }
      );
    }
    const compatibleGradeIds = new Set((offering.gradeIds || []).map(String));
    const incompatible = classes.filter((classGroup) => !compatibleGradeIds.has(String(classGroup.gradeId)));

    const allowIncompatible = body.allowIncompatible === true;

    if (!allowIncompatible && incompatible.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "One or more class groups are outside this offering's grade coverage",
          data: { incompatibleClassGroupIds: incompatible.map((item) => String(item._id)) },
        },
        { status: 400 }
      );
    }

    const compatibleClassIds = allowIncompatible
      ? classes.map((classGroup) => classGroup._id)
      : classes
          .filter((classGroup) => compatibleGradeIds.has(String(classGroup.gradeId)))
          .map((classGroup) => classGroup._id);

    if (!allowIncompatible) {
      await ClassGroup.updateMany(
        { schoolId, gradeId: { $in: offering.gradeIds || [] } },
        { $pull: { subjectOfferingIds: offeringId } }
      );
    }

    const result = await ClassGroup.updateMany(
      { _id: { $in: compatibleClassIds }, schoolId },
      { $addToSet: { subjectOfferingIds: offeringId, subjectIds: offering.subjectId } }
    );

    return NextResponse.json({
      success: true,
      data: { assignedClassGroups: result.modifiedCount ?? 0 },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to assign class groups";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
