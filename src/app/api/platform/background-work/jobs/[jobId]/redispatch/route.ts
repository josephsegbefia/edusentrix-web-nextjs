import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { writeBackgroundJobAudit } from "@/lib/background/audit";
import { redispatchBackgroundJob } from "@/lib/background/enqueue-job";
import { toSafeBackgroundJobDTO } from "@/lib/background/serializers";
import { BackgroundJob } from "@/models/BackgroundJob";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const gate = await requirePlatformPermission("platform.system.settings.read");
    if (!gate.ok) return gate.res;

    const { jobId } = await context.params;
    if (!Types.ObjectId.isValid(jobId)) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    await connectToDatabase();
    const existing = await BackgroundJob.findById(jobId);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    if (existing.status !== "dispatch_failed" && existing.inngestEventId) {
      return NextResponse.json(
        { success: false, error: "Job is already dispatched" },
        { status: 409 }
      );
    }

    const result = await redispatchBackgroundJob(jobId);
    await writeBackgroundJobAudit({
      actionCode: "background.job.redispatched",
      actor: { userId: gate.actor.userId, isPlatformOperator: true },
      job: result.job,
      extra: { dispatched: result.dispatched },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...toSafeBackgroundJobDTO(result.job, {
          userId: gate.actor.userId,
          isPlatformOperator: true,
        }),
        dispatched: result.dispatched,
      },
    });
  } catch (error) {
    console.error("Failed to redispatch background job:", error);
    return NextResponse.json(
      { success: false, error: "Failed to redispatch background job" },
      { status: 500 }
    );
  }
}
