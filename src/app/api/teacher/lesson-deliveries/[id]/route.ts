import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonDelivery, type LessonDeliveryStatus } from "@/models/LessonDelivery";
import { LessonSession } from "@/models/LessonSession";
import { gateLessonsModule } from "@/lib/lessons/lesson-gates";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

const PatchSchema = z.object({
  status: z
    .enum(["scheduled", "in_progress", "delivered", "completed", "cancelled"])
    .optional(),
  actualTeacherId: z.string().min(1).optional().nullable(),
  substituteReason: z.enum(["leave", "absence", "delegation", "other"]).optional().nullable(),
});

const ALLOWED: Record<LessonDeliveryStatus, LessonDeliveryStatus[]> = {
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["delivered", "scheduled", "cancelled"],
  delivered: ["completed", "in_progress"],
  completed: [],
  cancelled: ["scheduled"],
};

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
    })
      .select("ownerTeacherId")
      .lean();

    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    const isOwner = String(session.ownerTeacherId) === String(context.teacherId);
    const isScheduled =
      String(delivery.scheduledTeacherId) === String(context.teacherId);
    if (!isOwner && !isScheduled && !context.isAdmin) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    if (parsed.data.status) {
      const next = parsed.data.status;
      const allowed = ALLOWED[delivery.status] || [];
      if (!allowed.includes(next) && next !== delivery.status) {
        return Response.json(
          {
            success: false,
            error: `Cannot change delivery status from ${delivery.status} to ${next}.`,
          },
          { status: 400 },
        );
      }
      delivery.status = next;
      const now = new Date();
      if (next === "in_progress" && !delivery.startedAt) delivery.startedAt = now;
      if (next === "delivered") delivery.endedAt = now;
      if (next === "completed") {
        delivery.completedAt = now;
        delivery.completedByTeacherId = context.teacherId;
      }
    }

    if (parsed.data.actualTeacherId !== undefined) {
      if (parsed.data.actualTeacherId === null) {
        delivery.actualTeacherId = null;
      } else {
        const tid = toObjectId(parsed.data.actualTeacherId);
        if (!tid) {
          return Response.json({ success: false, error: "Invalid teacher ID" }, { status: 400 });
        }
        delivery.actualTeacherId = tid;
      }
    } else if (parsed.data.status === "in_progress" || parsed.data.status === "delivered") {
      delivery.actualTeacherId = context.teacherId;
    }

    if (parsed.data.substituteReason !== undefined) {
      delivery.substituteReason = parsed.data.substituteReason;
    }

    if (
      delivery.actualTeacherId &&
      String(delivery.actualTeacherId) !== String(delivery.ownerTeacherId) &&
      !delivery.substituteReason
    ) {
      return Response.json(
        {
          success: false,
          error: "Substitute reason is required when a different teacher delivers the lesson.",
        },
        { status: 400 },
      );
    }

    await delivery.save();

    return Response.json({
      success: true,
      data: {
        id: String(delivery._id),
        status: delivery.status,
        actualTeacherId: delivery.actualTeacherId ? String(delivery.actualTeacherId) : null,
        substituteReason: delivery.substituteReason ?? null,
        startedAt: delivery.startedAt?.toISOString() ?? null,
        endedAt: delivery.endedAt?.toISOString() ?? null,
        completedAt: delivery.completedAt?.toISOString() ?? null,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-deliveries PATCH]", e);
    const message = e instanceof Error ? e.message : "Failed to update delivery";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
