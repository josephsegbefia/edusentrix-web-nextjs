import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import { Teacher } from "@/models/Teacher";
import { gateLessonsModule } from "@/lib/lessons/lesson-gates";
import { formatLessonSessionDetail } from "@/lib/lessons/format-lesson-session";
import { pickLessonDeliveryForClass } from "@/lib/lessons/delivery-schedule";
import { canManageLessonSessionContent } from "@/lib/lessons/session-access";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

const AssignSchema = z.object({
  substituteTeacherId: z.string().min(1),
  substituteReason: z.enum(["leave", "absence", "delegation", "other"]).optional(),
});

export async function POST(
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
    const parsed = AssignSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    const substituteOid = toObjectId(parsed.data.substituteTeacherId);
    if (!substituteOid) {
      return Response.json({ success: false, error: "Invalid substitute teacher ID" }, { status: 400 });
    }

    if (String(substituteOid) === String(session.ownerTeacherId)) {
      return Response.json(
        { success: false, error: "The session owner is already the scheduled teacher." },
        { status: 400 },
      );
    }

    const substitute = await Teacher.findOne({
      _id: substituteOid,
      schoolId: context.schoolId,
      status: "active",
    })
      .select("_id")
      .lean();
    if (!substitute) {
      return Response.json({ success: false, error: "Substitute teacher not found" }, { status: 404 });
    }

    const classGroupId = new URL(req.url).searchParams.get("classGroupId");
    const deliveries = await LessonDelivery.find({
      sessionId: session._id,
      schoolId: context.schoolId,
    });
    const delivery = pickLessonDeliveryForClass(
      deliveries,
      session.classGroupId,
      classGroupId,
    );
    if (!delivery) {
      return Response.json({ success: false, error: "Delivery not found" }, { status: 404 });
    }

    if (delivery.status === "completed" || delivery.status === "cancelled") {
      return Response.json(
        { success: false, error: "Cannot change substitute on a completed or cancelled delivery." },
        { status: 400 },
      );
    }

    delivery.scheduledTeacherId = substituteOid;
    delivery.substituteReason = parsed.data.substituteReason ?? "delegation";
    await delivery.save();

    return Response.json({
      success: true,
      data: {
        session: formatLessonSessionDetail({ session: session.toObject(), delivery: delivery.toObject() }),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-sessions substitute POST]", e);
    const message = e instanceof Error ? e.message : "Failed to assign substitute";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
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

    const classGroupId = new URL(req.url).searchParams.get("classGroupId");
    const deliveries = await LessonDelivery.find({
      sessionId: session._id,
      schoolId: context.schoolId,
    });
    const delivery = pickLessonDeliveryForClass(
      deliveries,
      session.classGroupId,
      classGroupId,
    );
    if (!delivery) {
      return Response.json({ success: false, error: "Delivery not found" }, { status: 404 });
    }

    delivery.scheduledTeacherId = session.ownerTeacherId;
    delivery.substituteReason = null;
    await delivery.save();

    return Response.json({
      success: true,
      data: {
        session: formatLessonSessionDetail({ session: session.toObject(), delivery: delivery.toObject() }),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-sessions substitute DELETE]", e);
    const message = e instanceof Error ? e.message : "Failed to clear substitute";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
