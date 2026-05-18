import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { requireSessionTeachContext } from "@/lib/lessons/session-teach-access";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await requireSessionTeachContext(id);
    if ("error" in result) return result.error;

    const { context, delivery } = result;

    if (!can(context.permissions, PERMISSIONS.lessonTeachingModeManage)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();
    if (delivery.status === "scheduled" || delivery.status === "cancelled") {
      delivery.status = "in_progress";
      delivery.startedAt = delivery.startedAt ?? now;
      delivery.actualTeacherId = context.teacherId;
    } else if (delivery.status === "delivered") {
      delivery.status = "in_progress";
    }

    await delivery.save();

    return Response.json({
      success: true,
      data: {
        deliveryId: String(delivery._id),
        status: delivery.status,
        startedAt: delivery.startedAt?.toISOString() ?? null,
        actualTeacherId: String(delivery.actualTeacherId),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-sessions teach/start]", e);
    const message = e instanceof Error ? e.message : "Failed to start teaching";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
