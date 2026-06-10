import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { requireSessionTeachContext } from "@/lib/lessons/session-teach-access";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const classGroupId = new URL(req.url).searchParams.get("classGroupId");
    const result = await requireSessionTeachContext(id, classGroupId);
    if ("error" in result) return result.error;

    const { context, delivery } = result;

    if (!can(context.permissions, PERMISSIONS.lessonTeachingModeManage)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    if (delivery.status !== "in_progress" && delivery.status !== "scheduled") {
      return Response.json(
        {
          success: false,
          error: `Cannot end teaching while delivery is ${delivery.status}.`,
        },
        { status: 400 },
      );
    }

    const now = new Date();
    delivery.status = "delivered";
    delivery.endedAt = now;
    delivery.actualTeacherId = delivery.actualTeacherId ?? context.teacherId;
    if (!delivery.startedAt) delivery.startedAt = now;

    await delivery.save();

    return Response.json({
      success: true,
      data: {
        deliveryId: String(delivery._id),
        status: delivery.status,
        endedAt: delivery.endedAt.toISOString(),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[lesson-sessions teach/end]", e);
    const message = e instanceof Error ? e.message : "Failed to end teaching";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
