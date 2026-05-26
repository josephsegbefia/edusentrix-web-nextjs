import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";
import { LessonSession, type ILessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import { SubjectOffering } from "@/models/SubjectOffering";
import { SchoolSettings } from "@/models/SchoolSettings";
import { normalizeContentBlocks } from "@/lib/lessons/content-blocks";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireParent();
    await connectToDatabase();

    const { id: wardId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(wardId)) {
      return Response.json({ success: false, error: "Invalid student ID" }, { status: 400 });
    }

    await verifyGuardianAccess(context.userId, wardId);

    const settings = (await SchoolSettings.findOne({ schoolId: context.schoolId })
      .select("lessonsModule")
      .lean()) as { lessonsModule?: { parentSummaryVisibleToParents?: boolean } } | null;

    if (!settings?.lessonsModule?.parentSummaryVisibleToParents) {
      return Response.json({
        success: true,
        data: { visible: false as const, sessions: [] },
      });
    }

    const student = (await Student.findOne({
      _id: new mongoose.Types.ObjectId(wardId),
      schoolId: context.schoolId,
    })
      .select("_id classGroupId")
      .lean()) as { _id: mongoose.Types.ObjectId; classGroupId: mongoose.Types.ObjectId } | null;

    if (!student) {
      return Response.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    // Sessions visible to parents: parentVisibility true OR delivery completed for this class
    const completedSessionIds = (await LessonDelivery.distinct("sessionId", {
      schoolId: context.schoolId,
      classGroupId: student.classGroupId,
      status: "completed",
    })) as mongoose.Types.ObjectId[];

    const orClauses: Record<string, unknown>[] = [{ parentVisibility: true }];
    if (completedSessionIds.length > 0) {
      orClauses.push({ _id: { $in: completedSessionIds } });
    }

    const rows = (await LessonSession.find({
      schoolId: context.schoolId,
      classGroupId: student.classGroupId,
      status: { $ne: "archived" as const },
      $or: orClauses,
    })
      .sort({ scheduledDate: -1 })
      .limit(80)
      .select("_id title subjectOfferingId scheduledDate parentVisibility contentBlocks")
      .lean()) as Pick<
      ILessonSession,
      "_id" | "title" | "subjectOfferingId" | "scheduledDate" | "parentVisibility" | "contentBlocks"
    >[];

    // Subject names
    const offeringIds = [
      ...new Set(
        rows.filter((s) => s.subjectOfferingId).map((s) => String(s.subjectOfferingId))
      ),
    ].map((id) => new mongoose.Types.ObjectId(id));

    const offerings =
      offeringIds.length > 0
        ? await SubjectOffering.find({
            _id: { $in: offeringIds },
            schoolId: context.schoolId,
          })
            .select("_id displayName shortName")
            .lean()
        : [];

    const offeringNames = new Map(
      offerings.map((o) => [String(o._id), o.displayName || o.shortName || "Subject"])
    );

    const sessions = rows.map((s) => {
      const blocks = normalizeContentBlocks(s.contentBlocks ?? []);
      return {
        id: String(s._id),
        title: s.title,
        subjectName: s.subjectOfferingId
          ? (offeringNames.get(String(s.subjectOfferingId)) ?? null)
          : null,
        scheduledDate: s.scheduledDate
          ? new Date(s.scheduledDate).toISOString().slice(0, 10)
          : null,
        hasParentSummary: blocks.length > 0,
      };
    });

    return Response.json({
      success: true,
      data: { visible: true as const, sessions },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[parent/wards/[id]/lesson-sessions GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load sessions";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
