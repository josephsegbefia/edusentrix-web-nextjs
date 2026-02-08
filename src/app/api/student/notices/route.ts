import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Notice } from "@/models/Notice";
import { Student } from "@/models/Student";
import { ClassGroup } from "@/models/ClassGroup";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type StudentScopeRow = {
  _id: mongoose.Types.ObjectId;
  classGroupId?: mongoose.Types.ObjectId;
  subjectAddIds?: mongoose.Types.ObjectId[];
  subjectRemoveIds?: mongoose.Types.ObjectId[];
};

type ClassGroupSubjectsRow = {
  _id: mongoose.Types.ObjectId;
  subjectIds?: mongoose.Types.ObjectId[];
};

type NoticeRow = {
  _id: mongoose.Types.ObjectId;
  title: string;
  message: string;
  status: "draft" | "published" | "scheduled" | "archived";
  audience: "class" | "subject" | "school" | "custom";
  classGroupIds?: mongoose.Types.ObjectId[];
  subjectIds?: mongoose.Types.ObjectId[];
  targetStudentIds?: mongoose.Types.ObjectId[];
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
    size?: number;
  }>;
  scheduledFor?: Date | null;
  publishedAt?: Date | null;
  createdAt?: Date | null;
};

export async function GET(req: NextRequest) {
  try {
    const context = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();

    const student = (await Student.findOne({
      userId: context.userId,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id classGroupId subjectAddIds subjectRemoveIds")
      .lean()) as StudentScopeRow | null;

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const classGroup = student.classGroupId
      ? ((await ClassGroup.findOne({
          _id: student.classGroupId,
          schoolId: context.schoolId,
        })
          .select("_id subjectIds")
          .lean()) as ClassGroupSubjectsRow | null)
      : null;

    const effectiveSubjectIdSet = new Set<string>(
      (classGroup?.subjectIds || []).map((id) => String(id))
    );
    (student.subjectAddIds || []).forEach((id) => effectiveSubjectIdSet.add(String(id)));
    (student.subjectRemoveIds || []).forEach((id) =>
      effectiveSubjectIdSet.delete(String(id))
    );

    const effectiveSubjectIds = Array.from(effectiveSubjectIdSet).map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const rawLimit = Number.parseInt(searchParams.get("limit") || "", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 40;

    const audienceFilters: Array<Record<string, unknown>> = [
      { audience: "school" },
      { audience: "custom", targetStudentIds: student._id },
    ];

    if (student.classGroupId) {
      audienceFilters.push({
        audience: "class",
        classGroupIds: student.classGroupId,
      });
    }

    if (effectiveSubjectIds.length > 0) {
      audienceFilters.push({
        audience: "subject",
        subjectIds: { $in: effectiveSubjectIds },
      });
    }

    const andFilters: Array<Record<string, unknown>> = [{ $or: audienceFilters }];

    if (search) {
      const regex = { $regex: escapeRegex(search), $options: "i" };
      andFilters.push({
        $or: [{ title: regex }, { message: regex }],
      });
    }

    const notices = (await Notice.find({
      schoolId: context.schoolId,
      status: "published",
      $and: andFilters,
    })
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(limit)
      .select(
        "title message status audience classGroupIds subjectIds targetStudentIds attachments scheduledFor publishedAt createdAt"
      )
      .lean()) as unknown as NoticeRow[];

    return NextResponse.json({
      success: true,
      data: {
        notices: notices.map((notice) => ({
          id: String(notice._id),
          title: notice.title,
          message: notice.message,
          status: notice.status,
          audience: notice.audience,
          attachments: notice.attachments || [],
          counts: {
            classGroups: notice.classGroupIds?.length || 0,
            subjects: notice.subjectIds?.length || 0,
            students: notice.targetStudentIds?.length || 0,
          },
          scheduledFor: notice.scheduledFor
            ? notice.scheduledFor.toISOString()
            : null,
          publishedAt: notice.publishedAt
            ? notice.publishedAt.toISOString()
            : null,
          createdAt: notice.createdAt ? notice.createdAt.toISOString() : null,
        })),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Failed to fetch student notices:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch notices",
      },
      { status: 500 }
    );
  }
}
