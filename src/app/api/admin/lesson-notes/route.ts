import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { LessonNote, type ILessonNote } from "@/models/LessonNote";
import {
  LessonNoteReviewComment,
  type ILessonNoteReviewComment,
} from "@/models/LessonNoteReviewComment";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Teacher } from "@/models/Teacher";
import { User } from "@/models/User";
import { formatUserDisplayName } from "@/lib/lesson-notes/review";

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function normalizeWeekOf(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function formatLessonNoteResponse(
  entry: ILessonNote,
  classNameMap: Map<string, string>,
  subjectMap: Map<string, string>,
  teacherNameMap: Map<string, string>,
  commentCountMap: Map<string, { total: number; open: number }>
) {
  const commentStats = commentCountMap.get(String(entry._id)) || { total: 0, open: 0 };

  return {
    id: String(entry._id),
    schoolId: String(entry.schoolId),
    teacherId: String(entry.teacherId),
    teacherName: teacherNameMap.get(String(entry.teacherId)) || null,
    classGroupId: String(entry.classGroupId),
    className: classNameMap.get(String(entry.classGroupId)) || "",
    subjectOfferingId: entry.subjectOfferingId ? String(entry.subjectOfferingId) : null,
    subjectId: entry.subjectId ? String(entry.subjectId) : null,
    subjectName: entry.subjectOfferingId
      ? subjectMap.get(String(entry.subjectOfferingId)) || ""
      : entry.subjectId
        ? subjectMap.get(String(entry.subjectId)) || ""
        : null,
    academicPeriodId: entry.academicPeriodId ? String(entry.academicPeriodId) : null,
    templateType: entry.templateType || "SIMPLE",
    curriculumCode: (entry as unknown as Record<string, unknown>).curriculumCode || null,
    curriculumMetadata:
      (entry as unknown as Record<string, unknown>).curriculumMetadata || null,
    unitPlannerData: (entry as unknown as Record<string, unknown>).unitPlannerData || null,
    weekOf: entry.weekOf ? new Date(entry.weekOf).toISOString() : null,
    date: entry.date ? new Date(entry.date).toISOString() : null,
    weekEndingDate: entry.weekEndingDate ? new Date(entry.weekEndingDate).toISOString() : null,
    topic: entry.topic,
    durationMinutes: entry.durationMinutes || null,
    references: entry.references || [],
    curriculum: entry.curriculum || null,
    tlms: entry.tlms || [],
    body: entry.body || null,
    assessment: entry.assessment || null,
    reflections: entry.reflections || null,
    resources: entry.resources || [],
    tags: entry.tags || [],
    status: entry.status,
    submittedAt: entry.submittedAt ? new Date(entry.submittedAt).toISOString() : null,
    approvedAt: entry.approvedAt ? new Date(entry.approvedAt).toISOString() : null,
    approvedBy: entry.approvedBy ? String(entry.approvedBy) : null,
    rejectionReason: entry.rejectionReason || null,
    exportUrls: entry.exportUrls || null,
    objectives: entry.objectives || null,
    content: entry.content || null,
    createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
    updatedAt: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : null,
    schemeId: entry.schemeId ? String(entry.schemeId) : null,
    schemeItemIds: (entry.schemeItemIds || []).map((id) => String(id)),
    totalCommentCount: commentStats.total,
    openCommentCount: commentStats.open,
  };
}

export async function GET(req: Request) {
  try {
    const context = await requireSchoolAdmin();
    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const classGroupId = searchParams.get("classGroupId");
    const subjectOfferingId = searchParams.get("subjectOfferingId");
    const subjectId = searchParams.get("subjectId");
    const teacherId = searchParams.get("teacherId");
    const templateType = searchParams.get("templateType");
    const status = searchParams.get("status");
    const weekOf = searchParams.get("weekOf");
    const search = searchParams.get("search");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.max(Number(limitParam), 1) : 100;

    const query: Record<string, unknown> = {
      schoolId: context.schoolId,
    };

    if (classGroupId) {
      const classGroupObjId = toObjectIdOrNull(classGroupId);
      if (!classGroupObjId) {
        return Response.json(
          { success: false, error: "Invalid class group ID" },
          { status: 400 }
        );
      }
      query.classGroupId = classGroupObjId;
    }

    if (subjectOfferingId) {
      const subjectOfferingObjId = toObjectIdOrNull(subjectOfferingId);
      if (!subjectOfferingObjId) {
        return Response.json(
          { success: false, error: "Invalid subject offering ID" },
          { status: 400 }
        );
      }
      query.subjectOfferingId = subjectOfferingObjId;
    }

    if (subjectId) {
      const subjectObjId = toObjectIdOrNull(subjectId);
      if (!subjectObjId) {
        return Response.json(
          { success: false, error: "Invalid subject ID" },
          { status: 400 }
        );
      }
      query.subjectId = subjectObjId;
    }

    if (teacherId) {
      const teacherObjId = toObjectIdOrNull(teacherId);
      if (!teacherObjId) {
        return Response.json(
          { success: false, error: "Invalid teacher ID" },
          { status: 400 }
        );
      }
      query.teacherId = teacherObjId;
    }

    if (templateType) {
      query.templateType = templateType;
    }

    if (status) {
      query.status = status;
    }

    if (weekOf) {
      const weekDate = normalizeWeekOf(new Date(weekOf));
      if (Number.isNaN(weekDate.getTime())) {
        return Response.json(
          { success: false, error: "Invalid week value" },
          { status: 400 }
        );
      }
      query.weekOf = weekDate;
    }

    if (search) {
      query.$or = [
        { topic: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    const [entries, total] = await Promise.all([
      LessonNote.find(query)
        .sort({ weekOf: -1, createdAt: -1 })
        .limit(limit)
        .lean() as Promise<ILessonNote[]>,
      LessonNote.countDocuments(query),
    ]);

    if (entries.length === 0) {
      return Response.json({
        success: true,
        data: {
          entries: [],
          summary: {
            total,
            byStatus: {},
            openComments: 0,
          },
        },
      });
    }

    const noteIds = entries.map((entry) => entry._id);
    const classGroupIds = Array.from(
      new Set(entries.map((entry) => String(entry.classGroupId)))
    ).map((id) => new mongoose.Types.ObjectId(id));
    const subjectIds = Array.from(
      new Set(
        entries
          .map((entry) => entry.subjectId)
          .filter(Boolean)
          .map((id) => String(id))
      )
    ).map((id) => new mongoose.Types.ObjectId(id));
    const subjectOfferingIds = Array.from(
      new Set(
        entries
          .map((entry) => entry.subjectOfferingId)
          .filter(Boolean)
          .map((id) => String(id))
      )
    ).map((id) => new mongoose.Types.ObjectId(id));
    const teacherIds = Array.from(
      new Set(entries.map((entry) => String(entry.teacherId)))
    ).map((id) => new mongoose.Types.ObjectId(id));

    const [classGroups, subjects, subjectOfferings, teachers, commentStats] = await Promise.all([
      ClassGroup.find({ _id: { $in: classGroupIds } })
        .select("_id name gradeId")
        .lean(),
      subjectIds.length
        ? Subject.find({ _id: { $in: subjectIds } }).select("_id name").lean()
        : Promise.resolve([]),
      subjectOfferingIds.length
        ? SubjectOffering.find({ _id: { $in: subjectOfferingIds }, schoolId: context.schoolId })
            .select("_id displayName shortName")
            .lean()
        : Promise.resolve([]),
      Teacher.find({ _id: { $in: teacherIds } }).select("_id userId").lean(),
      LessonNoteReviewComment.aggregate<{
        _id: mongoose.Types.ObjectId;
        total: number;
        open: number;
      }>([
        {
          $match: {
            schoolId: context.schoolId,
            lessonNoteId: { $in: noteIds },
          },
        },
        {
          $group: {
            _id: "$lessonNoteId",
            total: { $sum: 1 },
            open: {
              $sum: {
                $cond: [{ $eq: ["$status", "resolved"] }, 0, 1],
              },
            },
          },
        },
      ]),
    ]);

    const gradeIds = Array.from(
      new Set(
        classGroups
          .map((group: { gradeId?: mongoose.Types.ObjectId }) => group.gradeId)
          .filter(Boolean)
          .map((id) => String(id))
      )
    ).map((id) => new mongoose.Types.ObjectId(id));

    const [grades, teacherUsers] = await Promise.all([
      gradeIds.length
        ? Grade.find({ _id: { $in: gradeIds } }).select("_id name").lean()
        : Promise.resolve([]),
      teachers.length
        ? User.find({
            _id: {
              $in: Array.from(
                new Set(
                  teachers
                    .map((teacher: { userId?: mongoose.Types.ObjectId }) => teacher.userId)
                    .filter(Boolean)
                ),
              ),
            },
          })
            .select("_id name firstName lastName email")
            .lean()
        : Promise.resolve([]),
    ]);

    const gradeMap = new Map(
      grades.map((grade: { _id: mongoose.Types.ObjectId; name: string }) => [
        String(grade._id),
        grade.name,
      ])
    );

    const classNameMap = new Map(
      classGroups.map(
        (group: {
          _id: mongoose.Types.ObjectId;
          name: string;
          gradeId?: mongoose.Types.ObjectId;
        }) => {
          const gradeName = group.gradeId ? gradeMap.get(String(group.gradeId)) : undefined;
          const label = `${gradeName ? `${gradeName} ` : ""}${group.name}`.trim();
          return [String(group._id), label || group.name];
        }
      )
    );

    const subjectMap = new Map(
      subjects.map((subject: { _id: mongoose.Types.ObjectId; name: string }) => [
        String(subject._id),
        subject.name,
      ])
    );
    for (const offering of subjectOfferings as Array<{
      _id: mongoose.Types.ObjectId;
      displayName?: string;
      shortName?: string;
    }>) {
      subjectMap.set(String(offering._id), offering.displayName || offering.shortName || "");
    }

    const teacherUserMap = new Map(
      teacherUsers.map(
        (user: {
          _id: mongoose.Types.ObjectId;
          name?: string;
          firstName?: string;
          lastName?: string;
          email?: string;
        }) => [String(user._id), user]
      )
    );

    const teacherNameMap = new Map(
      teachers.map(
        (teacher: { _id: mongoose.Types.ObjectId; userId?: mongoose.Types.ObjectId }) => [
          String(teacher._id),
          formatUserDisplayName(
            teacher.userId ? teacherUserMap.get(String(teacher.userId)) : null,
            "Unknown teacher"
          ),
        ]
      )
    );

    const commentCountMap = new Map(
      commentStats.map((item) => [String(item._id), { total: item.total, open: item.open }])
    );

    const summaryByStatus = entries.reduce<Partial<Record<ILessonNote["status"], number>>>(
      (acc, entry) => {
        acc[entry.status] = (acc[entry.status] || 0) + 1;
        return acc;
      },
      {}
    );

    const data = entries.map((entry) =>
      formatLessonNoteResponse(
        entry,
        classNameMap,
        subjectMap,
        teacherNameMap,
        commentCountMap
      )
    );

    return Response.json({
      success: true,
      data: {
        entries: data,
        summary: {
          total,
          byStatus: summaryByStatus,
          openComments: Array.from(commentCountMap.values()).reduce(
            (sum, item) => sum + item.open,
            0
          ),
        },
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch admin lesson notes:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch admin lesson notes";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
