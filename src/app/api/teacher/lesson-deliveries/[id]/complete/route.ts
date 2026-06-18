import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonDelivery } from "@/models/LessonDelivery";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";
import { LessonSession } from "@/models/LessonSession";
import { gateLessonsModule } from "@/lib/lessons/lesson-gates";
import { writeCoverageForCompletedDelivery } from "@/lib/lessons/complete-lesson-delivery";
import { applyStudentPublishAfterDeliveryComplete } from "@/lib/lessons/publish-session-after-complete";
import { canCompleteLessonDelivery } from "@/lib/lessons/session-access";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function POST(
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
    if (!can(context.permissions, PERMISSIONS.lessonsUpdate)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const deliveryOid = toObjectId(id);
    if (!deliveryOid) {
      return Response.json({ success: false, error: "Invalid delivery ID" }, { status: 400 });
    }

    const delivery = await LessonDelivery.findOne({
      _id: deliveryOid,
      schoolId: context.schoolId,
    });

    if (!delivery) {
      return Response.json({ success: false, error: "Delivery not found" }, { status: 404 });
    }

    const session = await LessonSession.findOne({
      _id: delivery.sessionId,
      schoolId: context.schoolId,
    });

    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    if (
      !canCompleteLessonDelivery({
        session,
        delivery,
        teacherId: context.teacherId,
        isAdmin: context.isAdmin,
      })
    ) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    if (delivery.status === "completed") {
      return Response.json({
        success: true,
        data: {
          status: delivery.status,
          completedAt: delivery.completedAt?.toISOString() ?? null,
          coverageRecordsWritten: 0,
        },
      });
    }

    if (delivery.status !== "delivered" && delivery.status !== "in_progress") {
      return Response.json(
        {
          success: false,
          error: "Mark the lesson as delivered before completing it.",
        },
        { status: 400 },
      );
    }

    const now = new Date();
    if (!delivery.endedAt) delivery.endedAt = now;
    delivery.status = "completed";
    delivery.completedAt = now;
    delivery.completedByTeacherId = context.teacherId;
    delivery.actualTeacherId = delivery.actualTeacherId ?? context.teacherId;
    await delivery.save();

    const coverageRecordsWritten = await writeCoverageForCompletedDelivery({
      session,
      delivery,
      teacherId: context.teacherId,
    });

    const publishResult = applyStudentPublishAfterDeliveryComplete({
      session,
      requireTeacherReviewForAiContent: gate.settings.requireTeacherReviewForAiContent,
    });

    let studentPublished = false;
    if (publishResult.published) {
      await session.save();
      studentPublished = true;
      await LessonFlashcardDeck.updateOne(
        { schoolId: context.schoolId, sessionId: session._id },
        {
          $set: { status: "published" },
          $addToSet: { publishToClassGroupIds: session.classGroupId },
        }
      );
    }

    return Response.json({
      success: true,
      data: {
        status: delivery.status,
        completedAt: delivery.completedAt.toISOString(),
        coverageRecordsWritten,
        studentPublished,
        studentPublishBlockedReason: publishResult.blockedReason ?? null,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-deliveries complete]", e);
    const message = e instanceof Error ? e.message : "Failed to complete delivery";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
