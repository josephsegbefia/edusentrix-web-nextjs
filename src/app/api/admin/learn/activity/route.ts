import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { LearnActivityEvent, type LearnActivityEventType } from "@/models/LearnActivityEvent";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";

type CountByTypeRow = {
  _id: LearnActivityEventType;
  count: number;
};

type CountByClassRow = {
  _id: Types.ObjectId;
  count: number;
};

type NamedRow = {
  _id: Types.ObjectId;
  name: string;
};

const EVENT_LABELS: Record<LearnActivityEventType, string> = {
  quest_completed: "Quests completed",
  leo_tutor_message: "Leo tutor messages",
  flashcard_reviewed: "Flashcards reviewed",
  revision_session: "Revision sessions",
  exam_prep_practice: "Exam prep practice",
  explore_with_leo: "Explore with Leo",
  language_practice: "Language practice",
  assignment_help: "Assignment help",
  login: "Logins",
};

export async function GET() {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();

    const start = new Date();
    start.setDate(start.getDate() - 30);

    const [activeAccounts, inactiveAccounts, pendingFirstLogin, eventRows, classRows, gradeRows] =
      await Promise.all([
        LearnStudentAccount.countDocuments({
          schoolId: ctx.schoolId,
          status: { $in: ["active", "pending_first_login", "locked"] },
        }),
        LearnStudentAccount.countDocuments({
          schoolId: ctx.schoolId,
          status: "disabled",
        }),
        LearnStudentAccount.countDocuments({
          schoolId: ctx.schoolId,
          status: "pending_first_login",
        }),
        LearnActivityEvent.aggregate<CountByTypeRow>([
          { $match: { schoolId: ctx.schoolId, occurredAt: { $gte: start } } },
          { $group: { _id: "$eventType", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        LearnActivityEvent.aggregate<CountByClassRow>([
          {
            $match: {
              schoolId: ctx.schoolId,
              occurredAt: { $gte: start },
              classGroupId: { $ne: null },
            },
          },
          { $group: { _id: "$classGroupId", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        LearnActivityEvent.aggregate<CountByClassRow>([
          {
            $match: {
              schoolId: ctx.schoolId,
              occurredAt: { $gte: start },
              gradeId: { $ne: null },
            },
          },
          { $group: { _id: "$gradeId", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
      ]);

    const [classes, grades] = await Promise.all([
      ClassGroup.find({ _id: { $in: classRows.map((row) => row._id) }, schoolId: ctx.schoolId })
        .select("_id name")
        .lean<NamedRow[]>(),
      Grade.find({ _id: { $in: gradeRows.map((row) => row._id) }, schoolId: ctx.schoolId })
        .select("_id name")
        .lean<NamedRow[]>(),
    ]);
    const classMap = new Map(classes.map((row) => [String(row._id), row.name]));
    const gradeMap = new Map(grades.map((row) => [String(row._id), row.name]));

    return NextResponse.json({
      success: true,
      data: {
        rangeDays: 30,
        metrics: {
          activeAccounts,
          inactiveAccounts,
          pendingFirstLogin,
          totalActivity: eventRows.reduce((sum, row) => sum + row.count, 0),
        },
        events: eventRows.map((row) => ({
          eventType: row._id,
          label: EVENT_LABELS[row._id],
          count: row.count,
        })),
        classBreakdown: classRows.map((row) => ({
          classGroupId: String(row._id),
          classGroupName: classMap.get(String(row._id)) || "Class group",
          count: row.count,
        })),
        gradeBreakdown: gradeRows.map((row) => ({
          gradeId: String(row._id),
          gradeName: gradeMap.get(String(row._id)) || "Grade",
          count: row.count,
        })),
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[admin/learn/activity:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Learn activity." },
      { status: 500 }
    );
  }
}
