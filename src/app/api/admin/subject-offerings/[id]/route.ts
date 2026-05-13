import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { requireSchoolAdminOrTeacherRead } from "@/lib/auth/requireSchoolAdminOrTeacherRead";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { SubjectOffering } from "@/models/SubjectOffering";
import { TeacherAssignment } from "@/models/TeacherAssignment";

function toId(value: string): mongoose.Types.ObjectId | null {
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requireSchoolAdminOrTeacherRead();
    await connectToDatabase();
    const { id } = await ctx.params;
    const offeringId = toId(id);
    if (!offeringId) return NextResponse.json({ success: false, error: "Invalid offering id" }, { status: 400 });
    const offering = await SubjectOffering.findOne({ _id: offeringId, schoolId }).populate("subjectId", "name category").lean();
    if (!offering) return NextResponse.json({ success: false, error: "Subject offering not found" }, { status: 404 });
    const gradeIds = Array.isArray(offering.gradeIds) ? offering.gradeIds : [];
    const [grades, classes, teacherRows] = await Promise.all([
      gradeIds.length
        ? Grade.find({ _id: { $in: gradeIds }, schoolId })
            .select("_id name code stage order")
            .sort({ order: 1, name: 1 })
            .lean()
        : [],
      ClassGroup.find({ schoolId, subjectOfferingIds: offeringId })
        .populate("gradeId", "name code stage order")
        .select("_id name gradeId isActive")
        .sort({ name: 1 })
        .lean(),
      TeacherAssignment.find({ schoolId, subjectOfferingId: offeringId, status: "active" })
        .populate({
          path: "teacherId",
          select: "userId",
          populate: { path: "userId", select: "firstName lastName email avatarUrl" },
        })
        .populate("classGroupId", "name gradeId")
        .select("_id teacherId classGroupId")
        .lean(),
    ]);

    const teachers = teacherRows.map((row: any) => {
      const teacher = row.teacherId;
      const user = teacher?.userId;
      return {
        assignmentId: String(row._id),
        id: String(teacher?._id ?? ""),
        fullName: `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || "Unknown teacher",
        email: user?.email ?? null,
        photoUrl: user?.avatarUrl ?? null,
        classGroupId: row.classGroupId?._id ? String(row.classGroupId._id) : null,
        classGroupName: row.classGroupId?.name ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(offering._id),
        subjectId: String((offering as any).subjectId?._id ?? offering.subjectId),
        subjectFamily: offering.subjectFamily,
        displayName: offering.displayName,
        shortName: offering.shortName,
        code: offering.code,
        curriculumCode: offering.curriculumCode,
        stage: offering.stage,
        gradeBand: offering.gradeBand,
        category: offering.category,
        lessonNoteTemplateVariant: offering.lessonNoteTemplateVariant ?? null,
        reportCardGroup: offering.reportCardGroup ?? null,
        isActive: offering.isActive !== false,
        grades: grades.map((grade: any) => ({
          id: String(grade._id),
          name: grade.name,
          code: grade.code ?? null,
          stage: grade.stage ?? null,
        })),
        classes: classes.map((classGroup: any) => {
          const grade = classGroup.gradeId;
          return {
            id: String(classGroup._id),
            name: classGroup.name,
            fullLabel: grade?.name ? `${grade.name} ${classGroup.name}` : classGroup.name,
            grade: grade
              ? { id: String(grade._id), name: grade.name, code: grade.code ?? null }
              : null,
            isActive: classGroup.isActive !== false,
          };
        }),
        teachers,
        createdAt: new Date(offering.createdAt).toISOString(),
        updatedAt: new Date(offering.updatedAt).toISOString(),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const message = e instanceof Error ? e.message : "Failed to fetch subject offering";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("subjects");
    await connectToDatabase();
    const { id } = await ctx.params;
    const offeringId = toId(id);
    if (!offeringId) return NextResponse.json({ success: false, error: "Invalid offering id" }, { status: 400 });
    const body = await req.json();
    const update: Record<string, unknown> = {};
    for (const key of ["displayName", "shortName", "stage", "gradeBand", "category", "lessonNoteTemplateVariant", "reportCardGroup"] as const) {
      if (body[key] !== undefined) update[key] = body[key];
    }
    if (typeof body.code === "string") update.code = body.code.trim().toUpperCase();
    if (typeof body.isActive === "boolean") update.isActive = body.isActive;
    if (Array.isArray(body.gradeIds)) {
      const gradeIds = body.gradeIds
        .filter((gradeId: unknown) => typeof gradeId === "string" && mongoose.Types.ObjectId.isValid(gradeId))
        .map((gradeId: string) => new mongoose.Types.ObjectId(gradeId));
      const count = gradeIds.length ? await Grade.countDocuments({ _id: { $in: gradeIds }, schoolId }) : 0;
      if (count !== gradeIds.length) {
        return NextResponse.json({ success: false, error: "One or more grades do not belong to this school" }, { status: 400 });
      }
      update.gradeIds = gradeIds;
    }
    const offering = await SubjectOffering.findOneAndUpdate(
      { _id: offeringId, schoolId },
      { $set: update },
      { new: true }
    ).lean();
    if (!offering) return NextResponse.json({ success: false, error: "Subject offering not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: { id: String(offering._id) } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to update subject offering";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("subjects");
    await connectToDatabase();
    const { id } = await ctx.params;
    const offeringId = toId(id);
    if (!offeringId) return NextResponse.json({ success: false, error: "Invalid offering id" }, { status: 400 });
    const offering = await SubjectOffering.findOneAndUpdate(
      { _id: offeringId, schoolId },
      { $set: { isActive: false } },
      { new: true }
    ).lean();
    if (!offering) return NextResponse.json({ success: false, error: "Subject offering not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: { id: String(offering._id), isActive: false } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to deactivate subject offering";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
