import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import { Teacher } from "@/models/Teacher";
import { ClassGroup } from "@/models/ClassGroup";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Subject } from "@/models/Subject";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function toObjectIdOrNull(id: string | null | undefined) {
  if (!id) return null;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const context = await requireSchoolAdmin();
    await connectToDatabase();

    const url = new URL(req.url);
    const classGroupId = toObjectIdOrNull(url.searchParams.get("classGroupId"));
    const subjectId = toObjectIdOrNull(url.searchParams.get("subjectId"));
    const teacherId = toObjectIdOrNull(url.searchParams.get("teacherId"));
    const statusFilter = url.searchParams.get("status") as string | null;
    const weekStart = url.searchParams.get("weekStart");
    const weekEnd = url.searchParams.get("weekEnd");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(url.searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10)),
    );

    const filter: mongoose.FilterQuery<typeof LessonSession> = {
      schoolId: context.schoolId,
    };

    if (classGroupId) filter.classGroupId = classGroupId;
    if (teacherId) filter.ownerTeacherId = teacherId;

    // Subject filter — match by subjectOfferingId
    if (subjectId) {
      const offeringIds = await SubjectOffering.find({
        schoolId: context.schoolId,
        $or: [{ subjectId }, { _id: subjectId }],
      })
        .select("_id")
        .lean()
        .then((rows) => rows.map((r) => r._id));
      filter.subjectOfferingId = { $in: offeringIds };
    }

    if (weekStart) {
      const from = new Date(weekStart);
      if (!isNaN(from.getTime())) {
        filter.scheduledDate = { ...((filter.scheduledDate as object) || {}), $gte: from };
      }
    }
    if (weekEnd) {
      const to = new Date(weekEnd);
      if (!isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        filter.scheduledDate = { ...((filter.scheduledDate as object) || {}), $lte: to };
      }
    }

    const total = await LessonSession.countDocuments(filter);
    const sessions = await LessonSession.find(filter)
      .sort({ scheduledDate: -1, sequenceInWeek: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        "_id title scheduledDate startTime endTime durationMinutes ownerTeacherId classGroupId subjectOfferingId isDoublePeriod dayOfWeek status contentBlocks assessmentItems createdAt",
      )
      .lean();

    if (sessions.length === 0) {
      return Response.json({
        success: true,
        data: {
          sessions: [],
          stats: { total: 0, delivered: 0, pending: 0, missed: 0 },
          pagination: { page, limit, total: 0, pages: 0 },
        },
      });
    }

    const sessionIds = sessions.map((s) => s._id);

    // Fetch deliveries, teachers, class groups, subject offerings in parallel
    const [deliveries, teachers, classGroups, offerings] = await Promise.all([
      LessonDelivery.find({ sessionId: { $in: sessionIds }, schoolId: context.schoolId })
        .select("sessionId status completedAt startedAt scheduledTeacherId")
        .lean(),
      Teacher.find({
        _id: { $in: sessions.map((s) => s.ownerTeacherId) },
        schoolId: context.schoolId,
      })
        .select("_id userId")
        .populate({ path: "userId", select: "firstName lastName" })
        .lean<Array<{
          _id: mongoose.Types.ObjectId;
          userId?: { firstName?: string; lastName?: string } | null;
        }>>(),
      ClassGroup.find({
        _id: { $in: sessions.map((s) => s.classGroupId) },
        schoolId: context.schoolId,
      })
        .select("_id name gradeId")
        .populate({ path: "gradeId", select: "name" })
        .lean<Array<{
          _id: mongoose.Types.ObjectId;
          name?: string;
          gradeId?: { name?: string } | null;
        }>>(),
      SubjectOffering.find({
        _id: { $in: sessions.map((s) => s.subjectOfferingId).filter(Boolean) },
        schoolId: context.schoolId,
      })
        .select("_id displayName shortName subjectId")
        .populate({ path: "subjectId", select: "name" })
        .lean<Array<{
          _id: mongoose.Types.ObjectId;
          displayName?: string | null;
          shortName?: string | null;
          subjectId?: { name?: string } | null;
        }>>(),
    ]);

    const deliveryMap = new Map(
      deliveries.map((d) => [String(d.sessionId), d]),
    );
    const teacherMap = new Map(teachers.map((t) => [String(t._id), t]));
    const classMap = new Map(classGroups.map((c) => [String(c._id), c]));
    const offeringMap = new Map(offerings.map((o) => [String(o._id), o]));

    const DELIVERY_STATUS_MAP: Record<string, string> = {
      completed: "completed",
      in_progress: "in_progress",
      not_started: "not_started",
    };

    const rows = sessions.map((s) => {
      const delivery = deliveryMap.get(String(s._id));
      const teacher = teacherMap.get(String(s.ownerTeacherId));
      const classGroup = classMap.get(String(s.classGroupId));
      const offering = offeringMap.get(String(s.subjectOfferingId));

      const rawStatus = delivery?.status ?? "not_started";
      const deliveryStatus =
        DELIVERY_STATUS_MAP[rawStatus] ??
        (delivery ? "not_started" : "not_started");

      const teacherName = teacher?.userId
        ? `${teacher.userId.firstName ?? ""} ${teacher.userId.lastName ?? ""}`.trim()
        : "Unknown teacher";

      const classGroupName = classGroup
        ? `${(classGroup.gradeId as { name?: string } | null)?.name ?? ""} ${classGroup.name ?? ""}`.trim()
        : "Unknown class";

      const subjectName =
        offering?.shortName ||
        offering?.displayName ||
        (offering?.subjectId as { name?: string } | null)?.name ||
        "Unknown subject";

      const scheduledDateStr = s.scheduledDate instanceof Date
        ? s.scheduledDate.toISOString().split("T")[0]
        : String(s.scheduledDate).split("T")[0];

      return {
        id: String(s._id),
        title: s.title,
        scheduledDate: scheduledDateStr,
        startTime: s.startTime,
        endTime: s.endTime,
        durationMinutes: s.durationMinutes,
        dayOfWeek: s.dayOfWeek,
        teacherName,
        teacherId: String(s.ownerTeacherId),
        classGroupName,
        classGroupId: String(s.classGroupId),
        subjectName,
        subjectOfferingId: String(s.subjectOfferingId),
        deliveryStatus,
        completedAt: delivery?.completedAt?.toISOString() ?? null,
        contentBlockCount: s.contentBlocks?.length ?? 0,
        assessmentItemCount: (s as { assessmentItems?: unknown[] }).assessmentItems?.length ?? 0,
        status: s.status,
      };
    });

    // Apply delivery status filter after joining
    const filtered =
      statusFilter && statusFilter !== "all"
        ? rows.filter((r) => r.deliveryStatus === statusFilter)
        : rows;

    // Stats across the full unfiltered dataset (or filtered if status filter applied)
    const statsBase = statusFilter && statusFilter !== "all" ? filtered : rows;
    const delivered = statsBase.filter((r) => r.deliveryStatus === "completed").length;
    const inProgress = statsBase.filter((r) => r.deliveryStatus === "in_progress").length;
    const pending = statsBase.filter((r) => r.deliveryStatus === "not_started").length;

    return Response.json({
      success: true,
      data: {
        sessions: filtered,
        stats: {
          total: rows.length,
          delivered,
          inProgress,
          pending,
        },
        pagination: {
          page,
          limit,
          total: filtered.length,
          pages: Math.ceil(filtered.length / limit),
        },
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[admin/lesson-sessions GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load sessions";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
