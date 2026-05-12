import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getParentWardIds, requireParent } from "@/lib/auth/requireParent";
import { publishedProgramQueryForStudent } from "@/lib/supply-programs/eligibility";
import { getPaidQtyBySupplyLine } from "@/lib/supply-programs/progress";
import { CommunityPoll } from "@/models/CommunityPoll";
import { CommunityPollVote } from "@/models/CommunityPollVote";
import { Invoice } from "@/models/Invoice";
import { Lesson } from "@/models/Lesson";
import { LibraryLoan } from "@/models/LibraryLoan";
import { Meeting } from "@/models/Meeting";
import { MeetingParticipant } from "@/models/MeetingParticipant";
import { Student } from "@/models/Student";
import { SupplyProgram } from "@/models/SupplyProgram";
import { SupplyProgramLine } from "@/models/SupplyProgramLine";
import { TermResult } from "@/models/TermResult";

type ActionUrgency = "urgent" | "due_soon" | "new" | "completed";
type ActionModule =
  | "fees"
  | "meetings"
  | "polls"
  | "library"
  | "supplies"
  | "documents"
  | "reports"
  | "lessons"
  | "messages";

type ParentAction = {
  id: string;
  title: string;
  wardId: string | null;
  wardName: string | null;
  dueDate: string | null;
  urgency: ActionUrgency;
  module: ActionModule;
  deepLink: string;
  isCompleted: boolean;
};

type StudentRow = {
  _id: mongoose.Types.ObjectId;
  firstName?: string;
  lastName?: string;
  gradeId?: mongoose.Types.ObjectId;
  classGroupId?: mongoose.Types.ObjectId;
  parentDocumentRequests?: Array<{
    _id?: mongoose.Types.ObjectId;
    label?: string;
    requestedAt?: Date;
    fulfilledAt?: Date | null;
  }>;
};

type InvoiceRow = {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  invoiceNumber?: string;
  dueDate?: Date | null;
  status?: string;
  totalOutstandingMinor?: number;
};

type LibraryLoanRow = {
  _id: mongoose.Types.ObjectId;
  borrowerId: mongoose.Types.ObjectId;
  dueAt?: Date | null;
  status?: string;
};

type MeetingParticipantRow = {
  _id: mongoose.Types.ObjectId;
  meetingId: mongoose.Types.ObjectId;
  wardIds?: mongoose.Types.ObjectId[];
  inviteStatus?: "invited" | "accepted" | "declined";
  respondedAt?: Date | null;
};

type MeetingRow = {
  _id: mongoose.Types.ObjectId;
  title?: string;
  startsAt?: Date;
};

type PollRow = {
  _id: mongoose.Types.ObjectId;
  title?: string;
  schedule?: { endDate?: Date | null };
};

type SupplyProgramRow = {
  _id: mongoose.Types.ObjectId;
  name?: string;
  purchaseByDate?: Date | null;
};

type SupplyLineRow = {
  _id: mongoose.Types.ObjectId;
  required?: boolean;
  quantity?: number;
};

type TermResultRow = {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  calculatedAt?: Date;
};

type LessonRow = {
  _id: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  title?: string;
  publishedAt?: Date;
  updatedAt?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toIso(value?: Date | null) {
  return value ? value.toISOString() : null;
}

function studentName(student?: StudentRow) {
  if (!student) return null;
  return [student.firstName, student.lastName].filter(Boolean).join(" ").trim() || null;
}

function classifyDueDate(dueDate?: Date | null, now = new Date()): Exclude<ActionUrgency, "completed"> {
  if (!dueDate) return "new";
  if (dueDate.getTime() <= now.getTime()) return "urgent";
  if (dueDate.getTime() <= now.getTime() + 7 * DAY_MS) return "due_soon";
  return "new";
}

function pushAction(
  buckets: {
    urgent: ParentAction[];
    dueSoon: ParentAction[];
    newUpdates: ParentAction[];
    completedRecently: ParentAction[];
  },
  action: ParentAction
) {
  if (action.urgency === "urgent") buckets.urgent.push(action);
  else if (action.urgency === "due_soon") buckets.dueSoon.push(action);
  else if (action.urgency === "completed") buckets.completedRecently.push(action);
  else buckets.newUpdates.push(action);
}

function sortByDueDate(actions: ParentAction[]) {
  return actions.sort((a, b) => {
    const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
}

export async function GET() {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const wardIds = await getParentWardIds(context.userId);
    if (!wardIds.length) {
      return NextResponse.json({
        success: true,
        data: { urgent: [], dueSoon: [], newUpdates: [], completedRecently: [] },
      });
    }

    const now = new Date();
    const recentCutoff = new Date(now.getTime() - 14 * DAY_MS);
    const students = await Student.find({
      _id: { $in: wardIds },
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id firstName lastName gradeId classGroupId parentDocumentRequests")
      .lean<StudentRow[]>();

    const studentMap = new Map(students.map((student) => [String(student._id), student]));
    const activeWardIds = students.map((student) => student._id);
    const gradeIds = students
      .map((student) => student.gradeId)
      .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
    const classGroupIds = students
      .map((student) => student.classGroupId)
      .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
    const classGroupToStudent = new Map(
      students
        .filter((student) => student.classGroupId)
        .map((student) => [String(student.classGroupId), student])
    );

    const buckets = {
      urgent: [] as ParentAction[],
      dueSoon: [] as ParentAction[],
      newUpdates: [] as ParentAction[],
      completedRecently: [] as ParentAction[],
    };

    const invoices = await Invoice.find({
      schoolId: context.schoolId,
      studentId: { $in: activeWardIds },
      status: { $in: ["issued", "partially_paid", "overdue"] },
      totalOutstandingMinor: { $gt: 0 },
    })
      .select("_id studentId invoiceNumber dueDate status totalOutstandingMinor")
      .sort({ dueDate: 1 })
      .limit(20)
      .lean<InvoiceRow[]>();

    invoices.forEach((invoice) => {
      const student = studentMap.get(String(invoice.studentId));
      const urgency = invoice.status === "overdue" ? "urgent" : classifyDueDate(invoice.dueDate, now);
      pushAction(buckets, {
        id: `invoice-${invoice._id}`,
        title: `Pay ${invoice.invoiceNumber || "school invoice"}`,
        wardId: String(invoice.studentId),
        wardName: studentName(student),
        dueDate: toIso(invoice.dueDate),
        urgency,
        module: "fees",
        deepLink: "/(parent)/(tabs)/fees",
        isCompleted: false,
      });
    });

    const loans = await LibraryLoan.find({
      schoolId: context.schoolId,
      borrowerType: "student",
      borrowerId: { $in: activeWardIds },
      isOpen: true,
      dueAt: { $lte: new Date(now.getTime() + 7 * DAY_MS) },
    })
      .select("_id borrowerId dueAt status")
      .sort({ dueAt: 1 })
      .limit(12)
      .lean<LibraryLoanRow[]>();

    loans.forEach((loan) => {
      const student = studentMap.get(String(loan.borrowerId));
      const urgency = loan.status === "overdue" ? "urgent" : classifyDueDate(loan.dueAt, now);
      pushAction(buckets, {
        id: `library-${loan._id}`,
        title: urgency === "urgent" ? "Review overdue library item" : "Review library item due soon",
        wardId: String(loan.borrowerId),
        wardName: studentName(student),
        dueDate: toIso(loan.dueAt),
        urgency,
        module: "library",
        deepLink: "/(parent)/library",
        isCompleted: false,
      });
    });

    const participants = await MeetingParticipant.find({
      schoolId: context.schoolId,
      userId: context.userId,
      role: "parent",
      inviteStatus: { $in: ["invited", "accepted"] },
    })
      .select("_id meetingId wardIds inviteStatus respondedAt")
      .sort({ createdAt: -1 })
      .limit(30)
      .lean<MeetingParticipantRow[]>();

    const meetingIds = participants.map((participant) => participant.meetingId);
    const meetings = meetingIds.length
      ? await Meeting.find({
          _id: { $in: meetingIds },
          schoolId: context.schoolId,
          status: "scheduled",
          startsAt: { $gte: now },
        })
          .select("_id title startsAt")
          .lean<MeetingRow[]>()
      : [];
    const meetingMap = new Map(meetings.map((meeting) => [String(meeting._id), meeting]));

    participants.forEach((participant) => {
      const meeting = meetingMap.get(String(participant.meetingId));
      if (!meeting) return;
      const wardId = participant.wardIds?.find((id) => studentMap.has(String(id))) ?? null;
      const student = wardId ? studentMap.get(String(wardId)) : undefined;

      if (participant.inviteStatus === "invited") {
        pushAction(buckets, {
          id: `meeting-${participant._id}`,
          title: `Confirm meeting: ${meeting.title || "School meeting"}`,
          wardId: wardId ? String(wardId) : null,
          wardName: studentName(student),
          dueDate: toIso(meeting.startsAt),
          urgency: classifyDueDate(meeting.startsAt, now),
          module: "meetings",
          deepLink: `/(parent)/meetings/${meeting._id}`,
          isCompleted: false,
        });
      } else if (participant.respondedAt && participant.respondedAt >= recentCutoff) {
        pushAction(buckets, {
          id: `meeting-completed-${participant._id}`,
          title: `Meeting confirmed: ${meeting.title || "School meeting"}`,
          wardId: wardId ? String(wardId) : null,
          wardName: studentName(student),
          dueDate: toIso(participant.respondedAt),
          urgency: "completed",
          module: "meetings",
          deepLink: `/(parent)/meetings/${meeting._id}`,
          isCompleted: true,
        });
      }
    });

    const votedPolls = await CommunityPollVote.find({
      schoolId: context.schoolId,
      userId: context.userId,
      role: "parent",
    })
      .select("pollId")
      .lean<Array<{ pollId: mongoose.Types.ObjectId }>>();

    const votedPollIds = votedPolls.map((vote) => vote.pollId);
    const polls = await CommunityPoll.find({
      schoolId: context.schoolId,
      status: "live",
      _id: { $nin: votedPollIds },
      $and: [
        {
          $or: [
            { "schedule.startDate": { $exists: false } },
            { "schedule.startDate": null },
            { "schedule.startDate": { $lte: now } },
          ],
        },
        {
          $or: [
            { "schedule.endDate": { $exists: false } },
            { "schedule.endDate": null },
            { "schedule.endDate": { $gte: now } },
          ],
        },
      ],
      $or: [
        { "audience.scope": { $in: ["school", "parents"] } },
        { "audience.scope": "grade", "audience.gradeIds": { $in: gradeIds } },
        { "audience.scope": "class", "audience.classGroupIds": { $in: classGroupIds } },
      ],
    })
      .select("_id title schedule")
      .sort({ "schedule.endDate": 1, createdAt: -1 })
      .limit(10)
      .lean<PollRow[]>();

    polls.forEach((poll) => {
      pushAction(buckets, {
        id: `poll-${poll._id}`,
        title: `Respond to poll: ${poll.title || "School poll"}`,
        wardId: null,
        wardName: null,
        dueDate: toIso(poll.schedule?.endDate),
        urgency: classifyDueDate(poll.schedule?.endDate, now),
        module: "polls",
        deepLink: `/(parent)/polls/${poll._id}`,
        isCompleted: false,
      });
    });

    students.forEach((student) => {
      (student.parentDocumentRequests ?? []).forEach((request) => {
        const requestedAt = request.requestedAt ?? now;
        if (!request.fulfilledAt) {
          pushAction(buckets, {
            id: `document-${student._id}-${request._id ?? request.label}`,
            title: `Upload requested document: ${request.label || "Document"}`,
            wardId: String(student._id),
            wardName: studentName(student),
            dueDate: toIso(requestedAt),
            urgency: classifyDueDate(requestedAt, now),
            module: "documents",
            deepLink: "/(parent)/documents",
            isCompleted: false,
          });
        } else if (request.fulfilledAt >= recentCutoff) {
          pushAction(buckets, {
            id: `document-completed-${student._id}-${request._id ?? request.label}`,
            title: `Document uploaded: ${request.label || "Document"}`,
            wardId: String(student._id),
            wardName: studentName(student),
            dueDate: toIso(request.fulfilledAt),
            urgency: "completed",
            module: "documents",
            deepLink: "/(parent)/documents",
            isCompleted: true,
          });
        }
      });
    });

    await Promise.all(
      students.slice(0, 6).map(async (student) => {
        const programs = await SupplyProgram.find(
          publishedProgramQueryForStudent(context.schoolId, {
            _id: student._id,
            gradeId: student.gradeId,
            classGroupId: student.classGroupId,
          })
        )
          .select("_id name purchaseByDate")
          .sort({ purchaseByDate: 1, name: 1 })
          .limit(6)
          .lean<SupplyProgramRow[]>();

        await Promise.all(
          programs.map(async (program) => {
            const lines = await SupplyProgramLine.find({ programId: program._id })
              .select("_id required quantity")
              .lean<SupplyLineRow[]>();
            const requiredLines = lines.filter((line) => line.required);
            if (!requiredLines.length) return;

            const paidMap = await getPaidQtyBySupplyLine(
              context.schoolId,
              student._id,
              requiredLines.map((line) => line._id)
            );
            const hasOutstanding = requiredLines.some((line) => {
              const requiredQty = Math.max(1, line.quantity || 1);
              return (paidMap.get(String(line._id)) ?? 0) < requiredQty;
            });
            if (!hasOutstanding) return;

            pushAction(buckets, {
              id: `supply-${student._id}-${program._id}`,
              title: `Buy required supplies: ${program.name || "Supply list"}`,
              wardId: String(student._id),
              wardName: studentName(student),
              dueDate: toIso(program.purchaseByDate),
              urgency: classifyDueDate(program.purchaseByDate, now),
              module: "supplies",
              deepLink: `/(parent)/supplies/${program._id}`,
              isCompleted: false,
            });
          })
        );
      })
    );

    const termResults = await TermResult.find({
      schoolId: context.schoolId,
      studentId: { $in: activeWardIds },
      calculatedAt: { $gte: recentCutoff },
    })
      .select("_id studentId calculatedAt")
      .sort({ calculatedAt: -1 })
      .limit(10)
      .lean<TermResultRow[]>();

    termResults.forEach((result) => {
      const student = studentMap.get(String(result.studentId));
      pushAction(buckets, {
        id: `report-${result._id}`,
        title: "Read new academic report",
        wardId: String(result.studentId),
        wardName: studentName(student),
        dueDate: toIso(result.calculatedAt),
        urgency: "new",
        module: "reports",
        deepLink: "/(parent)/reports",
        isCompleted: false,
      });
    });

    const lessons = classGroupIds.length
      ? await Lesson.find({
          schoolId: context.schoolId,
          classGroupId: { $in: classGroupIds },
          status: "published",
          $or: [{ publishedAt: { $gte: recentCutoff } }, { updatedAt: { $gte: recentCutoff } }],
        })
          .select("_id classGroupId title publishedAt updatedAt")
          .sort({ publishedAt: -1, updatedAt: -1 })
          .limit(10)
          .lean<LessonRow[]>()
      : [];

    lessons.forEach((lesson) => {
      const student = classGroupToStudent.get(String(lesson.classGroupId));
      pushAction(buckets, {
        id: `lesson-${lesson._id}`,
        title: `View new lesson: ${lesson.title || "Lesson"}`,
        wardId: student ? String(student._id) : null,
        wardName: studentName(student),
        dueDate: toIso(lesson.publishedAt ?? lesson.updatedAt),
        urgency: "new",
        module: "lessons",
        deepLink: `/(parent)/lessons/${lesson._id}`,
        isCompleted: false,
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        urgent: sortByDueDate(buckets.urgent).slice(0, 20),
        dueSoon: sortByDueDate(buckets.dueSoon).slice(0, 20),
        newUpdates: sortByDueDate(buckets.newUpdates).slice(0, 20),
        completedRecently: sortByDueDate(buckets.completedRecently).slice(0, 10),
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to load action center";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
