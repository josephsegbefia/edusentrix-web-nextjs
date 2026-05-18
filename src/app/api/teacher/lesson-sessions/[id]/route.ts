import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { linkedAssignmentsSummaryForSession } from "@/lib/lessons/linked-session-assignments";
import { gateLessonsModule } from "@/lib/lessons/lesson-gates";
import { formatLessonSessionDetail } from "@/lib/lessons/format-lesson-session";
import { getLessonsModuleSettings } from "@/lib/lessons/settings";
import { loadLessonSessionForTeacher } from "@/lib/lessons/load-lesson-session";
import { canManageLessonSessionContent } from "@/lib/lessons/session-access";
import {
  assertSessionPublishAllowed,
  markAllAiBlocksReviewed,
  normalizeContentBlocks,
} from "@/lib/lessons/content-blocks";
import {
  buildTeachingDeckFromSession,
  teachingDeckNeedsRebuild,
} from "@/lib/lessons/build-teaching-deck";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

const PatchSchema = z.object({
  title: z.string().trim().min(1).max(220).optional(),
  planNotes: z.string().trim().max(12000).optional().nullable(),
  status: z.enum(["draft", "ready", "published", "archived"]).optional(),
  studentVisibility: z.enum(["hidden", "published"]).optional(),
  parentVisibility: z.boolean().optional(),
  adminVisibility: z.boolean().optional(),
  contentBlocks: z.array(z.record(z.string(), z.unknown())).optional(),
  markAllAiReviewed: z.boolean().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const gate = await gateLessonsModule(context.schoolId);
    if (!gate.ok) {
      return Response.json({ success: false, error: gate.error }, { status: gate.status });
    }
    if (!can(context.permissions, PERMISSIONS.lessonsRead)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const sessionOid = toObjectId(id);
    if (!sessionOid) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const loaded = await loadLessonSessionForTeacher({
      sessionId: sessionOid,
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      isAdmin: context.isAdmin,
    });

    if (loaded.kind === "not_found") {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }
    if (loaded.kind === "forbidden") {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const [settings, linkedAssignmentsSummary] = await Promise.all([
      getLessonsModuleSettings(context.schoolId),
      linkedAssignmentsSummaryForSession(context.schoolId, sessionOid),
    ]);
    const canManage = canManageLessonSessionContent({
      session: loaded.session,
      teacherId: context.teacherId,
      isAdmin: context.isAdmin,
    });

    return Response.json({
      success: true,
      data: {
        session: formatLessonSessionDetail({
          session: loaded.session,
          delivery: loaded.delivery,
        }),
        lessonsSettings: {
          enableLeoLessonTools: settings.enableLeoLessonTools,
          requireTeacherReviewForAiContent: settings.requireTeacherReviewForAiContent,
          enableTeachingMode: settings.enableTeachingMode,
          enableFlashcards: settings.enableFlashcards,
          enableResources: settings.enableResources,
          enableLessonReflection: settings.enableLessonReflection,
          parentSummaryVisibleToParents: settings.parentSummaryVisibleToParents,
        },
        access: {
          canManageContent: canManage,
          isSubstitute:
            Boolean(loaded.delivery) &&
            String(loaded.session.ownerTeacherId) !== String(context.teacherId) &&
            String(loaded.delivery!.scheduledTeacherId) === String(context.teacherId),
        },
        linkedAssignmentsSummary,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-sessions GET]", e);
    const message = e instanceof Error ? e.message : "Failed to load session";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();
    const gate = await gateLessonsModule(context.schoolId);
    if (!gate.ok) {
      return Response.json({ success: false, error: gate.error }, { status: gate.status });
    }
    if (!can(context.permissions, PERMISSIONS.lessonsUpdate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const settings = gate.settings;

    const { id } = await params;
    const sessionOid = toObjectId(id);
    if (!sessionOid) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const session = await LessonSession.findOne({
      _id: sessionOid,
      schoolId: context.schoolId,
    });

    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    if (
      !canManageLessonSessionContent({
        session,
        teacherId: context.teacherId,
        isAdmin: context.isAdmin,
      })
    ) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    const wasPublished = session.studentVisibility === "published";
    let contentChanged = false;

    if (parsed.data.title !== undefined) session.title = parsed.data.title;
    if (parsed.data.planNotes !== undefined) session.planNotes = parsed.data.planNotes;

    if (parsed.data.contentBlocks !== undefined) {
      session.contentBlocks = normalizeContentBlocks(parsed.data.contentBlocks);
      contentChanged = true;
    }

    if (parsed.data.markAllAiReviewed) {
      session.contentBlocks = markAllAiBlocksReviewed(
        normalizeContentBlocks(session.contentBlocks ?? []),
      );
      session.aiMetadata = {
        ...session.aiMetadata,
        teacherReviewedAllAi: true,
      };
      contentChanged = true;
    }

    if (parsed.data.status !== undefined) session.status = parsed.data.status;

    if (parsed.data.studentVisibility !== undefined) {
      if (parsed.data.studentVisibility === "published") {
        const publishGate = assertSessionPublishAllowed({
          contentBlocks: normalizeContentBlocks(session.contentBlocks ?? []),
          requireTeacherReviewForAiContent: settings.requireTeacherReviewForAiContent,
        });
        if (!publishGate.ok) {
          return Response.json({ success: false, error: publishGate.error }, { status: 400 });
        }
        if (!can(context.permissions, PERMISSIONS.lessonsPublish)) {
          return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
      }
      session.studentVisibility = parsed.data.studentVisibility;
      contentChanged = true;
    }

    if (parsed.data.parentVisibility !== undefined) {
      session.parentVisibility = parsed.data.parentVisibility;
    }
    if (parsed.data.adminVisibility !== undefined) {
      session.adminVisibility = parsed.data.adminVisibility;
    }

    if (contentChanged && (wasPublished || session.studentVisibility === "published")) {
      session.contentVersion = (session.contentVersion || 1) + 1;
    }

    if (
      parsed.data.contentBlocks !== undefined ||
      parsed.data.planNotes !== undefined
    ) {
      session.teachingDeck = buildTeachingDeckFromSession(session);
    } else if (teachingDeckNeedsRebuild(session, session.teachingDeck ?? undefined)) {
      session.teachingDeck = buildTeachingDeckFromSession(session);
    }

    await session.save();

    if (session.studentVisibility === "published") {
      await LessonFlashcardDeck.updateOne(
        { schoolId: context.schoolId, sessionId: session._id },
        { $set: { status: "published" } },
      );
    }

    const delivery = await LessonDelivery.findOne({
      sessionId: session._id,
      schoolId: context.schoolId,
    }).lean();

    return Response.json({
      success: true,
      data: {
        session: formatLessonSessionDetail({ session: session.toObject(), delivery }),
        lessonsSettings: {
          enableLeoLessonTools: settings.enableLeoLessonTools,
          requireTeacherReviewForAiContent: settings.requireTeacherReviewForAiContent,
          enableTeachingMode: settings.enableTeachingMode,
          enableFlashcards: settings.enableFlashcards,
          enableResources: settings.enableResources,
          enableLessonReflection: settings.enableLessonReflection,
          parentSummaryVisibleToParents: settings.parentSummaryVisibleToParents,
        },
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-sessions PATCH]", e);
    const message = e instanceof Error ? e.message : "Failed to update session";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
